// 아카이브 쿼리: 키셋(커서) 페이지 + 월 히스토그램. 무한 스크롤(/api/archive)과 우측 타임라인이 쓴다.
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { UNKNOWN_MONTH, isMonthKey, type MonthBucket } from '#lib/archive.ts';
import type { Db } from './db';
import { files, photos } from './db/schema';
import { baseConds, itemSelect, orderKey, toItem, type GalleryItem } from './gallery';
import { getSetting } from './settings';

export const ARCHIVE_PAGE = 120;
/** 월 묶음 기준 시간대 = 서버(Node) 로컬. 촬영 시각의 저장·표시도 같은 기준이라 월 경계가 어긋나지 않는다. */
export const ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

export type ArchiveFlags = { includeB: boolean; canToggleB: boolean };

/** B컷 정책(settings.b_cut_policy)과 ?b=1 을 합쳐 이번 요청의 B컷 포함 여부를 정한다. */
export async function archiveFlags(db: Db, admin: boolean, url: URL): Promise<ArchiveFlags> {
	const policy = await getSetting<'hidden' | 'toggle' | 'public'>(db, 'b_cut_policy', 'hidden');
	const canToggleB = admin || policy === 'toggle';
	const includeB = policy === 'public' || (canToggleB && url.searchParams.get('b') === '1');
	return { includeB, canToggleB };
}

/** 키셋 커서: 경계 항목의 taken_at(ISO, 없으면 null) + id. 정렬 키는 (coalesce(taken_at,'epoch'), id) 내림차순. */
export type ArchiveCursor = { ta: string | null; id: string };
const EPOCH = new Date(0).toISOString();

export type ArchivePageOptions = {
	admin: boolean;
	includeB: boolean;
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
	const conds = baseConds({ scope: { kind: 'archive' }, admin: o.admin, includeB: o.includeB });
	const dir = o.dir ?? 'older';
	const key = sql`(${orderKey}, ${photos.id})`;
	if (o.cursor) {
		const cur = sql`(${o.cursor.ta ?? EPOCH}::timestamptz, ${o.cursor.id})`;
		conds.push(dir === 'older' ? sql`${key} < ${cur}` : sql`${key} > ${cur}`);
	}
	if (isMonthKey(o.from)) {
		if (o.from === UNKNOWN_MONTH) conds.push(sql`${photos.takenAt} is null`);
		else {
			const [y, m] = o.from.split('-').map(Number);
			const next = `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, '0')}-01 00:00:00`;
			// 다음 달 1일 0시(서버 시간대) 미만 → 그 달부터 과거로
			conds.push(sql`${orderKey} < (${next}::timestamp at time zone ${ZONE})`);
		}
	}
	const rows = await db
		.select(itemSelect)
		.from(photos)
		.innerJoin(files, eq(files.id, photos.primaryFileId))
		.where(and(...conds))
		.orderBy(
			...(dir === 'older' ? [desc(orderKey), desc(photos.id)] : [asc(orderKey), asc(photos.id)])
		)
		.limit(o.limit + 1);
	const items = rows.slice(0, o.limit).map(toItem);
	if (dir === 'newer') items.reverse();
	return { items, hasMore: rows.length > o.limit };
}

/** 월별 사진 수 (최신 → 과거, 날짜 없음은 맨 뒤). 타임라인 눈금 + 총합. */
export async function archiveMonths(
	db: Db,
	o: { admin: boolean; includeB: boolean }
): Promise<MonthBucket[]> {
	const conds = baseConds({ scope: { kind: 'archive' }, admin: o.admin, includeB: o.includeB });
	const rows = await db
		.select({
			key: sql<string>`case when ${photos.takenAt} is null then ${UNKNOWN_MONTH} else to_char(${photos.takenAt} at time zone ${ZONE}, 'YYYY-MM') end`,
			count: sql<number>`count(*)::int`
		})
		.from(photos)
		.innerJoin(files, eq(files.id, photos.primaryFileId))
		.where(and(...conds))
		.groupBy(sql`1`);
	return rows
		.map((r) => ({ key: r.key, count: Number(r.count) }))
		.sort((a, b) =>
			a.key === UNKNOWN_MONTH ? 1 : b.key === UNKNOWN_MONTH ? -1 : b.key.localeCompare(a.key)
		);
}
