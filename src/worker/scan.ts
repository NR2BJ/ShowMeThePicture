// Source 폴더를 걸어 files 테이블과 맞춘다. 신규/변경 파일은 process-file 잡으로.
import { opendir, stat } from 'node:fs/promises';
import path from 'node:path';
import { eq, inArray } from 'drizzle-orm';
import type { PgBoss } from 'pg-boss';
import type { Db } from '#lib/server/db/index.ts';
import { files, sources } from '#lib/server/db/schema.ts';
import { ensureFolderMeta } from '#lib/server/folders.ts';
import { extOf, IMAGE_EXTS, isIgnoredDir, kindOf } from '#lib/server/fs.ts';
import { Q, type ProcessFileJob } from '#lib/server/jobs.ts';
import { normalizeStem, stemOf } from '#lib/server/stem.ts';

type Entry = { rel: string; size: number; mtime: Date };

async function walk(root: string): Promise<Entry[]> {
	const out: Entry[] = [];
	async function visit(dirAbs: string, dirRel: string) {
		const dh = await opendir(dirAbs);
		for await (const ent of dh) {
			if (ent.isDirectory()) {
				if (!isIgnoredDir(ent.name))
					await visit(path.join(dirAbs, ent.name), dirRel ? `${dirRel}/${ent.name}` : ent.name);
			} else if (ent.isFile() && !ent.name.startsWith('.') && IMAGE_EXTS.has(extOf(ent.name))) {
				const abs = path.join(dirAbs, ent.name);
				const st = await stat(abs);
				out.push({
					rel: dirRel ? `${dirRel}/${ent.name}` : ent.name,
					size: st.size,
					mtime: st.mtime
				});
			}
		}
	}
	await visit(root, '');
	return out;
}

export type ScanSummary = {
	seen: number;
	added: number;
	changed: number;
	missing: number;
	requeued: number;
};

export async function scanSource(
	db: Db,
	boss: PgBoss,
	sourceId: string,
	full: boolean
): Promise<ScanSummary> {
	const [source] = await db.select().from(sources).where(eq(sources.id, sourceId)).limit(1);
	if (!source) throw new Error(`source not found: ${sourceId}`);

	const entries = await walk(source.rootPath);
	const dirs = new Set(
		entries.map((e) => path.posix.dirname(e.rel)).map((d) => (d === '.' ? '' : d))
	);
	await ensureFolderMeta(db, source, dirs);
	const existing = await db
		.select({
			id: files.id,
			relPath: files.relPath,
			size: files.size,
			mtime: files.mtime,
			status: files.status,
			ready: files.derivativesReady,
			failed: files.processError
		})
		.from(files)
		.where(eq(files.sourceId, sourceId));
	const byRel = new Map(existing.map((f) => [f.relPath, f]));
	const seenRel = new Set<string>();
	const toProcess: string[] = [];
	const summary: ScanSummary = {
		seen: entries.length,
		added: 0,
		changed: 0,
		missing: 0,
		requeued: 0
	};

	const allowLabel = source.role === 'edit';
	const inserts: (typeof files.$inferInsert)[] = [];
	for (const e of entries) {
		seenRel.add(e.rel);
		const prev = byRel.get(e.rel);
		if (!prev) {
			const filename = path.basename(e.rel);
			const ext = extOf(filename);
			const stem = stemOf(filename);
			const { base, label } = normalizeStem(stem, allowLabel);
			inserts.push({
				sourceId,
				relPath: e.rel,
				relPathNfc: e.rel.normalize('NFC'),
				filename,
				stem,
				stemNorm: base,
				editLabel: allowLabel ? label : null,
				ext,
				kind: kindOf(ext),
				size: e.size,
				mtime: e.mtime,
				status: 'active'
			});
			summary.added++;
		} else if (
			prev.size !== e.size ||
			Math.abs(prev.mtime.getTime() - e.mtime.getTime()) > 1000 ||
			prev.status === 'missing'
		) {
			await db
				.update(files)
				.set({
					size: e.size,
					mtime: e.mtime,
					status: 'active',
					derivativesReady: false,
					updatedAt: new Date()
				})
				.where(eq(files.id, prev.id));
			toProcess.push(prev.id);
			summary.changed++;
		} else if (full && (!prev.ready || prev.failed)) {
			toProcess.push(prev.id);
			summary.requeued++;
		}
	}
	for (let i = 0; i < inserts.length; i += 200) {
		const rows = await db
			.insert(files)
			.values(inserts.slice(i, i + 200))
			.returning({ id: files.id });
		toProcess.push(...rows.map((r) => r.id));
	}
	const gone = existing
		.filter((f) => !seenRel.has(f.relPath) && f.status !== 'missing')
		.map((f) => f.id);
	for (let i = 0; i < gone.length; i += 500) {
		await db
			.update(files)
			.set({ status: 'missing', updatedAt: new Date() })
			.where(inArray(files.id, gone.slice(i, i + 500)));
	}
	summary.missing = gone.length;

	for (const fileId of toProcess) {
		const data: ProcessFileJob = { fileId };
		await boss.send(Q.PROCESS_FILE, data, {
			singletonKey: `file:${fileId}`,
			retryLimit: 2,
			retryDelay: 30,
			expireInSeconds: 600
		});
	}
	await db
		.update(sources)
		.set({ lastScannedAt: new Date(), updatedAt: new Date() })
		.where(eq(sources.id, sourceId));
	return summary;
}
