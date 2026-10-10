// 시맨틱 검색: 질의/사진 벡터와 가까운 사진. 임베딩은 사진의 primary 파일 것(보정본 우선)을 쓴다.
import { and, eq, ne, sql } from 'drizzle-orm';
import {
	collapseNearDuplicates,
	DEFAULT_DUP_THRESHOLD,
	DEFAULT_SEARCH_MODEL
} from '#lib/search.ts';
import { config } from './config';
import type { Db } from './db';
import { embeddings, files, photos } from './db/schema';
import { embedText, normalizeNllbLang, type MlConfig } from './ml';
import { nearest, queryStats, resetLibraryCenter, type Hit, type HitVec } from './nearest';
import { getSetting } from './settings';

export { libraryCenter, nearest, queryStats, resetLibraryCenter, type Hit } from './nearest';

export async function mlConfig(db: Db): Promise<MlConfig> {
	return {
		url: config.ML_URL,
		model: await getSetting<string>(db, 'search_model', DEFAULT_SEARCH_MODEL),
		language: normalizeNllbLang(await getSetting<string>(db, 'search_language', 'ko'))
	};
}

/** 모델별 '맞는 사진 없음' 기준 유사도(설정 search_floor). 없거나 0 이면 null = 끔. */
export async function searchFloor(db: Db, model: string): Promise<number | null> {
	const m = await getSetting<Record<string, number>>(db, 'search_floor', {});
	const v = m?.[model];
	return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null;
}

export type SearchHit = Hit & { dup: number };
export type SearchResult = { items: SearchHit[]; mean: number; std: number; collapsed: number };

function stripVec(h: HitVec): Hit {
	const { vec, ...rest } = h;
	void vec;
	return rest;
}

/** 글로 찾기. ML 서버가 없으면 MlError 가 난다 — 호출 측에서 안내로 바꾼다.
 *  limit 의 두 배를 가져와 비슷한 컷(설정 search_dup)을 묶은 뒤 limit 장까지. mean/std 는 접기 기준·관리자 숫자용. */
export async function searchByText(
	db: Db,
	o: { admin: boolean; text: string; limit?: number }
): Promise<SearchResult> {
	const cfg = await mlConfig(db);
	const vec = await embedText(cfg, o.text);
	const limit = o.limit ?? 60;
	const dup = await getSetting<number>(db, 'search_dup', DEFAULT_DUP_THRESHOLD);
	const [hits, stats] = await Promise.all([
		nearest(db, { admin: o.admin, model: cfg.model, vec, limit: dup > 0 ? limit * 2 : limit }),
		queryStats(db, { model: cfg.model, vec })
	]);
	const shown = collapseNearDuplicates(hits, dup).kept.slice(0, limit);
	return {
		items: shown.map((h) => ({ ...stripVec(h), dup: h.dup })),
		mean: stats.mean,
		std: stats.std,
		collapsed: shown.reduce((a, h) => a + h.dup, 0)
	};
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
	const hits = await nearest(db, {
		admin: o.admin,
		model,
		vec: row.vec,
		limit: o.limit ?? 12,
		excludePhotoId: o.photoId
	});
	return hits.map(stripVec);
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
	resetLibraryCenter();
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
