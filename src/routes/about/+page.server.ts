import { error } from '@sveltejs/kit';
import { plainSummary, renderMarkdown } from '#lib/markdown.ts';
import type { OgMeta } from '#lib/og.ts';
import { config } from '#lib/server/config.ts';
import { db } from '#lib/server/db/app.ts';
import { siteInfo } from '#lib/server/site.ts';
import type { PageServerLoad } from './$types';

/** 소개: 설정의 소개 글(마크다운). 비어 있으면 게스트에겐 404, 관리자에겐 쓰러 가는 안내. */
export const load: PageServerLoad = async ({ locals }) => {
	const site = config.DATABASE_URL
		? await siteInfo(db())
		: { title: config.SITE_TITLE, description: '', aboutMd: '' };
	if (!site.aboutMd && !locals.admin) error(404);
	const og: OgMeta = {
		title: '소개',
		description: plainSummary(site.aboutMd) || site.description
	};
	return { html: renderMarkdown(site.aboutMd), empty: !site.aboutMd, og };
};
