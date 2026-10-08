// `pnpm test:schema` — 실제 Postgres 없이 PGlite(WASM Postgres 17)로 drizzle/*.sql 을 적용해 본다.
import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite-pgvector';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { readdir, readFile } from 'node:fs/promises';

const db = new PGlite({ extensions: { vector, pg_trgm } });
const dir = 'drizzle';
const sqlFiles = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
if (sqlFiles.length === 0) throw new Error('no migrations in drizzle/ — run pnpm db:generate');

for (const f of sqlFiles) {
	const text = await readFile(`${dir}/${f}`, 'utf8');
	for (const stmt of text.split('--> statement-breakpoint')) {
		const s = stmt.trim();
		if (s) await db.exec(s);
	}
	console.log('applied', f);
}

const tables = await db.query<{ table_name: string }>(
	`select table_name from information_schema.tables where table_schema = 'public' order by 1`
);
console.log('tables:', tables.rows.map((r) => r.table_name).join(', '));
const idx = await db.query<{ indexname: string }>(
	`select indexname from pg_indexes where schemaname = 'public' order by 1`
);
console.log('indexes:', idx.rows.length);

// 왕복 한 번: source → file → photo 와 벡터 컬럼
await db.exec(
	`insert into sources (id, slug, name, root_path, role) values ('S1','nx500','NX500','/photos/nx500','original')`
);
await db.exec(`insert into files (id, source_id, rel_path, rel_path_nfc, filename, stem, stem_norm, ext, kind, size, mtime)
  values ('F1','S1','2025-01-01/SAM_0001.SRW','2025-01-01/SAM_0001.SRW','SAM_0001.SRW','SAM_0001','SAM_0001','srw','raw',1000,now())`);
await db.exec(
	`insert into photos (id, primary_file_id, original_file_id, visibility, tier) values ('P1','F1','F1','public','A')`
);
const dim = Number(process.env.EMBEDDING_DIM ?? 768);
await db.exec(
	`insert into embeddings (file_id, model, embedding) values ('F1','test','[${Array(dim).fill(0).join(',')}]')`
);
const q = await db.query<{ n: number }>(
	`select count(*)::int as n from photos p join files f on f.id = p.primary_file_id where p.visibility = 'public'`
);
console.log('roundtrip ok, public photos =', q.rows[0].n);
await db.close();
