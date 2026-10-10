// 시맨틱 검색: 질의/사진 벡터와 가까운 사진. 임베딩은 사진의 primary 파일 것(보정본 우선)을 쓴다.
import { and, asc, eq, ne, sql } from 'drizzle-orm';
import { DEFAULT_SEARCH_MODEL } from '#lib/search.ts';
import { config } from './config';
import type { Db } from './db';
import { embeddings, files, photos } from './db/schema';
import { baseConds, itemSelect, toItem, type GalleryItem } from './gallery';
import { embedText, normalizeNllbLang, vectorLiteral, type MlConfig } from './ml';
import { getSetting } from './settings';

export async function mlConfig(db: Db): Promise<MlConfig> {
	return {
		url: config.ML_URL,
		model: await getSetting<string>(db, 'search_model', DEFAULT_SEARCH_MODEL),
		language: normalizeNllbLang(await getSetting<string>(db, 'search_language', 'ko'))
	};
}

export type Hit = GalleryItem & { dist: number };

async function nearest(
	db: Db,
	o: { admin: boolean; model: string; vec: number[]; limit: number; excludePhotoId?: string }
): Promise<Hit[]> {
	const q = sql`${vectorLiteral(o.vec)}::vector`;
	const dist = sql<number>`${embeddings.embedding} <=> ${q}`;
	const conds = [
		eq(embeddings.model, o.model),
		...baseConds({ scope: { kind: 'archive' }, admin: o.admin })
	];
	if (o.excludePhotoId) conds.push(ne(photos.id, o.excludePhotoId));
	const rows = await db
		.select({ ...itemSelect, dist })
		.from(embeddings)
		.innerJoin(photos, eq(photos.primaryFileId, embeddings.fileId))
		.innerJoin(files, eq(files.id, photos.primaryFileId))
		.where(and(...conds))
		.orderBy(asc(dist))
		.limit(o.limit);
	return rows.map((r) => ({ ...toItem(r), dist: Number(r.dist) }));
}

/** 글로 찾기. ML 서버가 없으면 MlError 가 난다 — 호출 측에서 안내로 바꾼다. */
export async function searchByText(
	db: Db,
	o: { admin: boolean; text: string; limit?: number }
): Promise<Hit[]> {
	const cfg = await mlConfig(db);
	const vec = await embedText(cfg, o.text);
	return nearest(db, { admin: o.admin, model: cfg.model, vec, limit: o.limit ?? 60 });
}

/** 이 사진과 비슷한 사진. 이 사진의 임베딩이 아직 없으면 빈 배열. */
export async function similarPhotos(
	db: Db,
	o: { admin: boolean; photoId: string; limit?: number }
): Promise<Hit[]> {
	const model = await getSetting<string>(db, 'search_model', DEFAULT_SEARCH_MODEL);
	const [row] = await db
		.select({ vec: embeddings.embedding, m: embeddings.model })
		.from(photos)
		.innerJoin(embeddings, eq(embeddings.fileId, photos.primaryFileId))
		.where(eq(photos.id, o.photoId))
		.limit(1);
	if (!row || row.m !== model) return [];
	return nearest(db, {
		admin: o.admin,
		model,
		vec: row.vec,
		limit: o.limit ?? 12,
		excludePhotoId: o.photoId
	});
}

/** 현재 모델로 임베딩된 사진 수 / 임베딩 대상(처리된 primary 파일) 수 */
export async function embeddingStats(
	db: Db
): Promise<{ model: string; done: number; total: number; other: number }> {
	const model = await getSetting<string>(db, 'search_model', DEFAULT_SEARCH_MODEL);
	const [t] = await db
		.select({
			total: sql<number>`count(*)::int`,
			done: sql<number>`count(*) filter (where ${embeddings.model} = ${model})::int`
		})
		.from(photos)
		.innerJoin(files, eq(files.id, photos.primaryFileId))
		.leftJoin(embeddings, eq(embeddings.fileId, files.id))
		.where(and(eq(files.status, 'active'), eq(files.derivativesReady, true)));
	const [o] = await db
		.select({ n: sql<number>`count(*)::int` })
		.from(embeddings)
		.where(ne(embeddings.model, model));
	return {
		model,
		done: Number(t?.done ?? 0),
		total: Number(t?.total ?? 0),
		other: Number(o?.n ?? 0)
	};
}

/** 임베딩 전부 삭제 — 같은 모델로 처음부터 다시 하고 싶을 때. 이후 '빠진 임베딩 채우기'. */
export async function clearEmbeddings(db: Db): Promise<number> {
	const r = await db.delete(embeddings).returning({ id: embeddings.fileId });
	return r.length;
}

/** 현재 모델 임베딩이 없는 primary 파일 id (전체 다시 임베딩 / 모델 변경 때) */
export async function filesNeedingEmbedding(db: Db, model: string): Promise<string[]> {
	const rows = await db
		.select({ id: files.id })
		.from(photos)
		.innerJoin(files, eq(files.id, photos.primaryFileId))
		.leftJoin(embeddings, eq(embeddings.fileId, files.id))
		.where(
			and(
				eq(files.status, 'active'),
				eq(files.derivativesReady, true),
				sql`(${embeddings.fileId} is null or ${embeddings.model} <> ${model})`
			)
		);
	return rows.map((r) => r.id);
}
