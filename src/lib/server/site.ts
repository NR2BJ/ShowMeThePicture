// 사이트 정보(제목·한 줄 소개·소개 글)와 링크 미리보기 기본 이미지. 설정(settings 테이블)에서 읽는다.
import { and, eq, inArray, sql } from 'drizzle-orm';
import { config } from './config';
import type { Db } from './db';
import { files, photos, settings } from './db/schema';
import { getSetting } from './settings';

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

/** 사이트 전체의 기본 미리보기 사진: 랜딩에 뜰 수 있는 사진(공개 + 설정에 따라 A컷 / A+B) 중 무작위 하나.
 *  그런 사진이 없으면 아무 공개 사진. (링크를 공유할 때마다 다른 사진이 걸릴 수 있다 — 디스코드 등은 미리보기를 한동안 캐시) */
export async function defaultOgPhotoId(db: Db): Promise<string | null> {
	const tiers =
		(await getSetting<'A' | 'AB'>(db, 'landing_tiers', 'A')) === 'AB' ? ['A', 'B'] : ['A'];
	const pick = async (landingOnly: boolean) => {
		const conds = [
			eq(photos.visibility, 'public'),
			eq(files.derivativesReady, true),
			eq(files.status, 'active')
		];
		if (landingOnly) conds.push(inArray(photos.tier, tiers as ('A' | 'B')[]));
		const [r] = await db
			.select({ id: photos.id })
			.from(photos)
			.innerJoin(files, eq(files.id, photos.primaryFileId))
			.where(and(...conds))
			.orderBy(sql`random()`)
			.limit(1);
		return r?.id ?? null;
	};
	return (await pick(true)) ?? (await pick(false));
}
