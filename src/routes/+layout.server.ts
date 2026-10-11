import { config } from '#lib/server/config.ts';
import { db } from '#lib/server/db/app.ts';
import { defaultOgPhotoId, siteInfo } from '#lib/server/site.ts';
import type { LayoutServerLoad } from './$types';

/** 사이트 제목·한 줄 소개(설정, 없으면 SITE_TITLE 환경변수)와 링크 미리보기 기본값. 페이지는 data.og 로 덮어쓴다. */
export const load: LayoutServerLoad = async ({ locals, url }) => {
	const site = config.DATABASE_URL
		? await siteInfo(db()).catch(() => ({
				title: config.SITE_TITLE,
				description: '',
				aboutMd: ''
			}))
		: { title: config.SITE_TITLE, description: '', aboutMd: '' };
	const ogPhoto = config.DATABASE_URL ? await defaultOgPhotoId(db()).catch(() => null) : null;
	return {
		site: { title: site.title, description: site.description, hasAbout: !!site.aboutMd },
		origin: url.origin,
		defaultOgImage: ogPhoto ? `/og/${ogPhoto}.jpg` : null,
		admin: locals.admin ? { username: locals.admin.username } : null
	};
};
