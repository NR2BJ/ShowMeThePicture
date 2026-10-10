// 벡터로 가까운 사진 찾기 (검색·비슷한 사진의 공통 경로) + 허브 억제. SvelteKit 설정(./config)에 묶이지 않아
// 워커·점검 스크립트(scripts/hub-check.ts)에서도 바로 쓴다.
import { and, desc, eq, ne, sql, type SQL } from 'drizzle-orm';
import { cosine } from '#lib/search.ts';
import type { Db } from './db';
import { embeddings, files, photos } from './db/schema';
import { baseConds, itemSelect, toItem, type GalleryItem } from './gallery';
import { vectorLiteral } from './ml';

export type Hit = GalleryItem & { dist: number };

/** 허브 억제용 라이브러리 중심. 모든 사진 벡터에 공통으로 들어 있는 평균 방향(μ̂) 성분은 내용과 무관한데, 회색 벽·흐린 컷·
 *  캄캄한 컷처럼 내용이 없는 사진은 그 성분이 커서 약한 질의마다 맨 위로 떠오른다(허브). 유사도에서
 *  cos(q,μ̂)·(cos(i,μ̂) − 평균) 을 빼면 그 공통 성분만 사라지고 내용 차이는 남는다(주성분 하나 제거, 'all-but-the-top').
 *  임베딩이 MIN_CENTER 장보다 적으면 평균이 불안정해 쓰지 않는다. 1분 캐시 — 질의마다 전체를 다시 훑지 않게. */
const MIN_CENTER = 30;
const CENTER_TTL_MS = 60_000;
type Center = { n: number; mu: number[] | null; abar: number; minCenter: number };
const centerCache = new Map<string, { at: number; c: Center }>();

export async function libraryCenter(
	db: Db,
	model: string,
	minCenter = MIN_CENTER
): Promise<Center> {
	const hit = centerCache.get(model);
	if (hit && hit.c.minCenter === minCenter && Date.now() - hit.at < CENTER_TTL_MS) return hit.c;
	const rows = (await db.execute(sql`
		with m as (
			select avg(${embeddings.embedding}) as v, count(*)::int as n
			from ${embeddings} where ${embeddings.model} = ${model}
		)
		select m.n as n, m.v::text as v,
			(select avg(1 - (${embeddings.embedding} <=> m.v)) from ${embeddings} where ${embeddings.model} = ${model}) as abar
		from m`)) as unknown as { n: number | string; v: string | null; abar: number | string | null }[];
	const r = rows[0];
	const n = Number(r?.n ?? 0);
	const c: Center =
		r?.v && n >= minCenter
			? { n, mu: JSON.parse(r.v) as number[], abar: Number(r.abar ?? 0), minCenter }
			: { n, mu: null, abar: 0, minCenter };
	centerCache.set(model, { at: Date.now(), c });
	return c;
}

/** 임베딩을 통째로 지웠을 때 중심 캐시도 비운다 (평소에는 TTL 로 따라간다) */
export function resetLibraryCenter(): void {
	centerCache.clear();
}

/** 보정 유사도 SQL: 1 − 코사인 거리에서 허브 성분을 뺀 값 (libraryCenter 참고). 중심이 없으면 원시 유사도. */
function scoreSql(vec: number[], c: Center): SQL<number> {
	const q = sql`${vectorLiteral(vec)}::vector`;
	const raw = sql`(1 - (${embeddings.embedding} <=> ${q}))`;
	if (!c.mu) return sql<number>`${raw}`;
	const mu = sql`${vectorLiteral(c.mu)}::vector`;
	return sql<number>`(${raw} - ${cosine(vec, c.mu)}::float8 * ((1 - (${embeddings.embedding} <=> ${mu})) - ${c.abar}::float8))`;
}

export type HitVec = Hit & { vec: number[] };

/** 벡터로 가까운 사진 (검색·비슷한 사진의 공통 경로). 사진 벡터(vec)도 같이 준다 — 비슷한 컷 묶기용이니 페이지로 보내기 전에 뗀다.
 *  minCenter 는 검증 스크립트용 — 작은 라이브러리에서도 허브 보정 경로를 타게. */
export async function nearest(
	db: Db,
	o: {
		admin: boolean;
		model: string;
		vec: number[];
		limit: number;
		excludePhotoId?: string;
		minCenter?: number;
	}
): Promise<HitVec[]> {
	const c = await libraryCenter(db, o.model, o.minCenter);
	const sim = scoreSql(o.vec, c);
	// dist 는 1 − (보정) 유사도 — 클라이언트가 1 − dist 로 되돌린다.
	const dist = sql<number>`1 - ${sim}`;
	const conds = [
		eq(embeddings.model, o.model),
		...baseConds({ scope: { kind: 'archive' }, admin: o.admin })
	];
	if (o.excludePhotoId) conds.push(ne(photos.id, o.excludePhotoId));
	const rows = await db
		.select({ ...itemSelect, dist, vec: embeddings.embedding })
		.from(embeddings)
		.innerJoin(photos, eq(photos.primaryFileId, embeddings.fileId))
		.innerJoin(files, eq(files.id, photos.primaryFileId))
		.where(and(...conds))
		.orderBy(desc(sim))
		.limit(o.limit);
	return rows.map((r) => ({ ...toItem(r), dist: Number(r.dist), vec: r.vec }));
}

/** 이 질의의 보정 유사도가 라이브러리 전체에서 어떻게 분포하는지 (평균·표준편차). 결과 접기 기준과 관리자용 z 에 쓴다. */
export async function queryStats(
	db: Db,
	o: { model: string; vec: number[]; minCenter?: number }
): Promise<{ mean: number; std: number }> {
	const c = await libraryCenter(db, o.model, o.minCenter);
	const sim = scoreSql(o.vec, c);
	const [r] = await db
		.select({
			mean: sql<number>`coalesce(avg(${sim}), 0)::float8`,
			std: sql<number>`coalesce(stddev_pop(${sim}), 0)::float8`
		})
		.from(embeddings)
		.where(eq(embeddings.model, o.model));
	return { mean: Number(r?.mean ?? 0), std: Number(r?.std ?? 0) };
}
