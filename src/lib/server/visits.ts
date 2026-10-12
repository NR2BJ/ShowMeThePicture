// 방문 통계: 사이트 순 방문자(하루 한 사람 한 번)와 사진별 조회수. 숫자는 관리자만 본다.
// 개인정보는 남기지 않는다 — 중복 방지 해시는 프로세스 메모리에만 있는 그날의 비밀값으로 만들고,
// 날이 바뀌면 비밀값과 지난 해시 행을 버린다. IP·브라우저 정보 원문은 어디에도 저장하지 않는다.
import { createHash, randomBytes } from 'node:crypto';
import { and, desc, eq, gte, lt, sql } from 'drizzle-orm';
import { mediaUrl, versionOf } from '#lib/media.ts';
import type { Db } from './db/index.ts';
import { files, photoViewDays, photos, visitDays, visitSeen } from './db/schema.ts';

const TZ = 'Asia/Tokyo';
const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ });

/** 그 시각의 날짜(YYYY-MM-DD, 일본 시간) */
export function dayOf(d = new Date()): string {
	return dayFmt.format(d);
}

/** 검색엔진·링크 미리보기·스크립트 도구 같은 사람 아닌 방문 */
const BOT =
	/bot|crawl|spider|slurp|preview|scrape|fetch|monitor|headless|lighthouse|pagespeed|facebookexternalhit|embedly|discord|telegram|whatsapp|kakaotalk-scrap|python|curl|wget|httpclient|okhttp|axios|node-fetch|go-http|java\//i;
export function isBot(ua: string | null | undefined): boolean {
	return !ua || ua.length < 20 || BOT.test(ua);
}

let salt: { day: string; value: Buffer } | null = null;
let purgedFor = '';

function anonHash(day: string, ip: string, ua: string): string {
	if (salt?.day !== day) salt = { day, value: randomBytes(32) };
	return createHash('sha256')
		.update(salt.value)
		.update(ip)
		.update('\0')
		.update(ua)
		.digest('base64url')
		.slice(0, 22);
}

/**
 * 방문 한 번 기록. target: 'site' = 사이트 방문, 그 외 = 사진 id (공개 사진만).
 * 같은 사람이 그날 이미 센 것이면 아무것도 안 한다. 새로 셌으면 true.
 */
export async function recordVisit(
	db: Db,
	o: { target: 'site' | { photoId: string }; ip: string; ua: string; now?: Date }
): Promise<boolean> {
	const day = dayOf(o.now);
	if (purgedFor !== day) {
		purgedFor = day;
		await db.delete(visitSeen).where(lt(visitSeen.day, day));
	}
	const target = o.target === 'site' ? '' : o.target.photoId;
	if (target) {
		const [p] = await db
			.select({ id: photos.id })
			.from(photos)
			.where(and(eq(photos.id, target), eq(photos.visibility, 'public')))
			.limit(1);
		if (!p) return false;
	}
	const inserted = await db
		.insert(visitSeen)
		.values({ day, target, hash: anonHash(day, o.ip, o.ua) })
		.onConflictDoNothing()
		.returning({ day: visitSeen.day });
	if (inserted.length === 0) return false;
	if (target)
		await db
			.insert(photoViewDays)
			.values({ photoId: target, day, views: 1 })
			.onConflictDoUpdate({
				target: [photoViewDays.photoId, photoViewDays.day],
				set: { views: sql`${photoViewDays.views} + 1` }
			});
	else
		await db
			.insert(visitDays)
			.values({ day, visitors: 1 })
			.onConflictDoUpdate({
				target: visitDays.day,
				set: { visitors: sql`${visitDays.visitors} + 1` }
			});
	return true;
}

const n = (v: unknown) => Number(v ?? 0);
function shift(day: string, days: number): string {
	const d = new Date(`${day}T00:00:00Z`);
	d.setUTCDate(d.getUTCDate() + days);
	return d.toISOString().slice(0, 10);
}

/** 대시보드 카드: TODAY · 어제 · TOTAL · 오늘 사진 조회 */
export async function visitSummary(db: Db, now = new Date()) {
	const today = dayOf(now);
	const yesterday = shift(today, -1);
	const [[v], [pv]] = await Promise.all([
		db
			.select({
				total: sql<number>`coalesce(sum(${visitDays.visitors}), 0)::int`,
				today: sql<number>`coalesce(sum(${visitDays.visitors}) filter (where ${visitDays.day} = ${today}), 0)::int`,
				yesterday: sql<number>`coalesce(sum(${visitDays.visitors}) filter (where ${visitDays.day} = ${yesterday}), 0)::int`
			})
			.from(visitDays),
		db
			.select({
				total: sql<number>`coalesce(sum(${photoViewDays.views}), 0)::int`,
				today: sql<number>`coalesce(sum(${photoViewDays.views}) filter (where ${photoViewDays.day} = ${today}), 0)::int`
			})
			.from(photoViewDays)
	]);
	return {
		today: n(v?.today),
		yesterday: n(v?.yesterday),
		total: n(v?.total),
		viewsToday: n(pv?.today),
		viewsTotal: n(pv?.total)
	};
}

/** 통계 페이지: 최근 days 일의 방문자·사진 조회 (빈 날은 0) */
export async function visitDaily(db: Db, days = 30, now = new Date()) {
	const today = dayOf(now);
	const from = shift(today, -(days - 1));
	const [vs, pvs] = await Promise.all([
		db.select().from(visitDays).where(gte(visitDays.day, from)),
		db
			.select({ day: photoViewDays.day, views: sql<number>`sum(${photoViewDays.views})::int` })
			.from(photoViewDays)
			.where(gte(photoViewDays.day, from))
			.groupBy(photoViewDays.day)
	]);
	const vm = new Map(vs.map((r) => [r.day, r.visitors]));
	const pm = new Map(pvs.map((r) => [r.day, n(r.views)]));
	return Array.from({ length: days }, (_, i) => {
		const day = shift(today, -i);
		return { day, visitors: vm.get(day) ?? 0, views: pm.get(day) ?? 0 };
	});
}

export type TopPhoto = { id: string; thumb: string; views: number };

/** 많이 본 사진 (sinceDays 를 주면 그 기간만) */
export async function topPhotos(
	db: Db,
	o: { sinceDays?: number; limit?: number; now?: Date } = {}
): Promise<TopPhoto[]> {
	const views = sql<number>`sum(${photoViewDays.views})::int`;
	const rows = await db
		.select({
			id: photos.id,
			fileId: files.id,
			contentHash: files.contentHash,
			rotation: files.rotation,
			views
		})
		.from(photoViewDays)
		.innerJoin(photos, eq(photos.id, photoViewDays.photoId))
		.innerJoin(files, eq(files.id, photos.primaryFileId))
		.where(
			o.sinceDays ? gte(photoViewDays.day, shift(dayOf(o.now), -(o.sinceDays - 1))) : undefined
		)
		.groupBy(photos.id, files.id)
		.orderBy(desc(views), desc(photos.id))
		.limit(o.limit ?? 12);
	return rows.map((r) => ({
		id: r.id,
		thumb: mediaUrl(r.fileId, 'thumb', versionOf(r.contentHash, r.rotation)),
		views: n(r.views)
	}));
}

/** 사진 한 장의 조회수 (전체 · 오늘) */
export async function photoViews(db: Db, photoId: string, now = new Date()) {
	const today = dayOf(now);
	const [r] = await db
		.select({
			total: sql<number>`coalesce(sum(${photoViewDays.views}), 0)::int`,
			today: sql<number>`coalesce(sum(${photoViewDays.views}) filter (where ${photoViewDays.day} = ${today}), 0)::int`
		})
		.from(photoViewDays)
		.where(eq(photoViewDays.photoId, photoId));
	return { total: n(r?.total), today: n(r?.today) };
}
