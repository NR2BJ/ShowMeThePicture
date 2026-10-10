// 아카이브 쿼리: 키셋(커서) 페이지 + 월 히스토그램 + 필터 facet. 무한 스크롤(/api/archive)과 우측 타임라인, 필터 바가 쓴다.
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import {
	KINDS,
	MEDIUMS,
	UNKNOWN_MONTH,
	isMonthKey,
	type ArchiveFacets,
	type ArchiveFilter,
	type FacetValue,
	type KindKey,
	type MediumKey,
	type MonthBucket
} from '#lib/archive.ts';
import type { Db } from './db';
import { files, photoMeta, photos } from './db/schema';
import { baseConds, itemSelect, orderKey, toItem, type GalleryItem } from './gallery';

export const ARCHIVE_PAGE = 120;
/** 월 묶음 기준 시간대 = 서버(Node) 로컬. 촬영 시각의 저장·표시도 같은 기준이라 월 경계가 어긋나지 않는다. */
export const ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

export type ArchiveOpts = { admin: boolean; filter?: ArchiveFilter };
const conds = (o: ArchiveOpts) =>
	baseConds({ scope: { kind: 'archive' }, admin: o.admin, filter: o.filter });

/** 키셋 커서: 경계 항목의 taken_at(ISO, 없으면 null) + id. 정렬 키는 (coalesce(taken_at,'epoch'), id) 내림차순. */
export type ArchiveCursor = { ta: string | null; id: string };
const EPOCH = new Date(0).toISOString();

export type ArchivePageOptions = ArchiveOpts & {
	limit: number;
	/** 이 항목보다 과거(older) 또는 최근(newer) 것만 */
	cursor?: ArchiveCursor | null;
	dir?: 'older' | 'newer';
	/** 'YYYY-MM' | 'unknown': 그 달(의 마지막 사진)부터 과거로 시작 — 타임라인 점프 */
	from?: string | null;
};

/** 항상 최신 → 과거 순으로 돌려준다 (newer 방향도 뒤집어서). */
export async function listArchive(
	db: Db,
	o: ArchivePageOptions
): Promise<{ items: GalleryItem[]; hasMore: boolean }> {
	const where = conds(o);
	const dir = o.dir ?? 'older';
	const key = sql`(${orderKey}, ${photos.id})`;
	if (o.cursor) {
		const cur = sql`(${o.cursor.ta ?? EPOCH}::timestamptz, ${o.cursor.id})`;
		where.push(dir === 'older' ? sql`${key} < ${cur}` : sql`${key} > ${cur}`);
	}
	if (isMonthKey(o.from)) {
		if (o.from === UNKNOWN_MONTH) where.push(sql`${photos.takenAt} is null`);
		else {
			const [y, m] = o.from.split('-').map(Number);
			const next = `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, '0')}-01 00:00:00`;
			// 다음 달 1일 0시(서버 시간대) 미만 → 그 달부터 과거로
			where.push(sql`${orderKey} < (${next}::timestamp at time zone ${ZONE})`);
		}
	}
	const rows = await db
		.select(itemSelect)
		.from(photos)
		.innerJoin(files, eq(files.id, photos.primaryFileId))
		.leftJoin(photoMeta, eq(photoMeta.photoId, photos.id))
		.where(and(...where))
		.orderBy(
			...(dir === 'older' ? [desc(orderKey), desc(photos.id)] : [asc(orderKey), asc(photos.id)])
		)
		.limit(o.limit + 1);
	const items = rows.slice(0, o.limit).map(toItem);
	if (dir === 'newer') items.reverse();
	return { items, hasMore: rows.length > o.limit };
}

/** 월별 사진 수 (최신 → 과거, 날짜 없음은 맨 뒤). 타임라인 눈금 + 총합. 필터를 따른다. */
export async function archiveMonths(db: Db, o: ArchiveOpts): Promise<MonthBucket[]> {
	const rows = await db
		.select({
			key: sql<string>`case when ${photos.takenAt} is null then ${UNKNOWN_MONTH} else to_char(${photos.takenAt} at time zone ${ZONE}, 'YYYY-MM') end`,
			count: sql<number>`count(*)::int`
		})
		.from(photos)
		.innerJoin(files, eq(files.id, photos.primaryFileId))
		.leftJoin(photoMeta, eq(photoMeta.photoId, photos.id))
		.where(and(...conds(o)))
		.groupBy(sql`1`);
	return rows
		.map((r) => ({ key: r.key, count: Number(r.count) }))
		.sort((a, b) =>
			a.key === UNKNOWN_MONTH ? 1 : b.key === UNKNOWN_MONTH ? -1 : b.key.localeCompare(a.key)
		);
}

/** 필터 바의 선택지별 장수. 각 축은 자기 필터만 빼고 센다 (다른 축의 필터는 적용) — 고른 뒤에도 다른 값으로 바로 바꿀 수 있게. */
export async function archiveFacets(db: Db, o: ArchiveOpts): Promise<ArchiveFacets> {
	const f = o.filter ?? {};
	const from = sql`from ${photos}
		inner join ${files} on ${files.id} = ${photos.primaryFileId}
		left join ${photoMeta} on ${photoMeta.photoId} = ${photos.id}`;
	const where = (without: keyof ArchiveFilter) =>
		sql.join(conds({ admin: o.admin, filter: { ...f, [without]: undefined } }), sql` and `);
	const run = async (q: ReturnType<typeof sql>): Promise<FacetValue[]> =>
		((await db.execute(q)) as unknown as { v: string | null; n: number }[])
			.filter((r) => r.v !== null)
			.map((r) => ({ v: r.v as string, n: Number(r.n) }));
	const [medium, kind, camera, lens, film] = await Promise.all([
		run(
			sql`select ${photos.medium}::text as v, count(*)::int as n ${from} where ${where('medium')} group by 1`
		),
		run(
			sql`select coalesce(${photos.tier}::text, 'original') as v, count(*)::int as n ${from} where ${where('kind')} group by 1`
		),
		run(
			sql`select ${photoMeta.camera} as v, count(*)::int as n ${from} where ${where('camera')} and ${photoMeta.camera} is not null group by 1 order by 2 desc, 1`
		),
		run(
			sql`select ${photoMeta.lens} as v, count(*)::int as n ${from} where ${where('lens')} and ${photoMeta.lens} is not null group by 1 order by 2 desc, 1`
		),
		run(
			sql`select ${photoMeta.filmStock} as v, count(*)::int as n ${from} where ${where('film')} and ${photoMeta.filmStock} is not null group by 1 order by 2 desc, 1`
		)
	]);
	const rec = <K extends string>(keys: readonly K[], vals: FacetValue[]) =>
		Object.fromEntries(keys.map((k) => [k, vals.find((x) => x.v === k)?.n ?? 0])) as Record<
			K,
			number
		>;
	return {
		medium: rec<MediumKey>(MEDIUMS, medium),
		kind: rec<KindKey>(KINDS, kind),
		camera,
		lens,
		film
	};
}
