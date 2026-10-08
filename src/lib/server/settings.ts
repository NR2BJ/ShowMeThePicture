// 앱 설정: settings 테이블(jsonb) + 기본값. 관리자 페이지에서 바꾸고 DB 에 남는다 (docs/DESIGN.md §8.1).
import { eq } from 'drizzle-orm';
import type { Db } from './db';
import { settings } from './db/schema';

export type AppSettings = {
	site_title: string;
	about_md: string;
	landing_mode: 'filmstrip';
	guest_max_edge: number;
	/** B컷을 게스트에게: 숨김 | 토글로 공개 | 항상 공개 */
	b_cut_policy: 'hidden' | 'toggle' | 'public';
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
		b_cut_policy: 'hidden',
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
