// 사이트 정보(제목·한 줄 소개·소개 글)와 링크 미리보기 기본 이미지. 설정(settings 테이블)에서 읽는다.
import { and, desc, eq, inArray } from 'drizzle-orm';
import { config } from './config';
import type { Db } from './db';
import { files, photos, settings } from './db/schema';

export type SiteInfo = { title: string; description: string; aboutMd: string };

export async function siteInfo(db: Db): Promise<SiteInfo> {
	const rows = await db
		.select({ key: settings.key, value: settings.value })
		.from(settings)
		.where(inArray(settings.key, ['site_title', 'site_description', 'about_md']));
	const get = (k: string) => {
		const v = rows.find((r) => r.key === k)?.value;
		return typeof v === 'string' ? v.trim() : '';
	};
	return {
		title: get('site_title') || config.SITE_TITLE,
		description: get('site_description'),
		aboutMd: get('about_md')
	};
}

/** 사이트 전체의 기본 미리보기 사진: 가장 최근 공개 A컷 (없으면 아무 공개 사진). 5분 캐시. */
let fallback: { at: number; id: string | null } | null = null;
export async function defaultOgPhotoId(db: Db): Promise<string | null> {
	if (fallback && Date.now() - fallback.at < 5 * 60_000) return fallback.id;
	const pick = async (tierA: boolean) => {
		const conds = [
			eq(photos.visibility, 'public'),
			eq(files.derivativesReady, true),
			eq(files.status, 'active')
		];
		if (tierA) conds.push(eq(photos.tier, 'A'));
		const [r] = await db
			.select({ id: photos.id })
			.from(photos)
			.innerJoin(files, eq(files.id, photos.primaryFileId))
			.where(and(...conds))
			.orderBy(desc(photos.takenAt))
			.limit(1);
		return r?.id ?? null;
	};
	const id = (await pick(true)) ?? (await pick(false));
	fallback = { at: Date.now(), id };
	return id;
}
