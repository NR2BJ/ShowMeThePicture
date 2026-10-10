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
	/** 검색 임베딩 모델 (Immich ML 모델 zoo 이름) */
	search_model: string;
	/** nllb 계열 텍스트 인코더의 질의 언어 (Immich 로케일 키: ko, en, ja, zh-CN; SigLIP2 등은 무시) */
	search_language: string;
	/** 모델별 '맞는 사진 없음' 기준 유사도 { 모델: 값 } — 1등이 이보다 낮으면 결과를 접고 안내. 없으면 끔 */
	search_floor: Record<string, number>;
	/** 검색 결과에서 비슷한 컷을 묶는 사진끼리 코사인 기준 (0 이면 끔) */
	search_dup: number;
	/** 검색 결과 다양성 재정렬 강도 (0 이면 끔) */
	search_diversity: number;
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
		scan_poll_minutes: env.SCAN_POLL_MINUTES,
		search_model: 'ViT-SO400M-16-SigLIP2-384__webli',
		search_language: 'ko',
		search_floor: {},
		search_dup: 0.97,
		search_diversity: 0.5
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
