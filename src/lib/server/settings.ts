// 앱 설정: settings 테이블(jsonb) + 기본값. 관리자 페이지에서 바꾸고 DB 에 남는다 (docs/DESIGN.md §8.1).
import { eq } from 'drizzle-orm';
import type { Db } from './db';
import { settings } from './db/schema';

export type AppSettings = {
	site_title: string;
	about_md: string;
	landing_mode: 'filmstrip';
	guest_max_edge: number;
	/** 랜딩 필름 스트립에 보일 컷: A만 | A+B (보정본 없는 원본만 있는 사진은 어차피 안 나온다) */
	landing_tiers: 'A' | 'AB';
	/** 랜딩 필름 프레임 높이 (화면 높이의 %), 5~50 */
	landing_strip_vh: number;
	/** 랜딩 필름 줄 수, 1~10 */
	landing_rows: number;
	show_gps: boolean;
	scan_poll_minutes: number;
};

export function settingsDefaults(env: {
	SITE_TITLE: string;
	GUEST_MAX_EDGE: number;
	SCAN_POLL_MINUTES: number;
}): AppSettings {
	return {
		site_title: env.SITE_TITLE,
		about_md: '',
		landing_mode: 'filmstrip',
		guest_max_edge: env.GUEST_MAX_EDGE,
		landing_tiers: 'A',
		landing_strip_vh: 21,
		landing_rows: 3,
		show_gps: false,
		scan_poll_minutes: env.SCAN_POLL_MINUTES
	};
}

export async function getSetting<T>(db: Db, key: string, fallback: T): Promise<T> {
	const row = await db
		.select({ value: settings.value })
		.from(settings)
		.where(eq(settings.key, key))
		.limit(1);
	return row.length ? (row[0].value as T) : fallback;
}

export async function setSetting(db: Db, key: string, value: unknown): Promise<void> {
	await db
		.insert(settings)
		.values({ key, value, updatedAt: new Date() })
		.onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } });
}

export async function getAppSettings(db: Db, defaults: AppSettings): Promise<AppSettings> {
	const rows = await db.select().from(settings);
	const out: AppSettings = { ...defaults };
	for (const r of rows) if (r.key in out) (out as Record<string, unknown>)[r.key] = r.value;
	return out;
}
