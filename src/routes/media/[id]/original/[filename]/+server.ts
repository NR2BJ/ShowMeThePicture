// 관리자 전용 원본: /media/<파일 id>/original/<실제 파일 이름>. 이름이 다르면 맞는 주소로 보낸다.
import { error, redirect } from '@sveltejs/kit';
import { db } from '#lib/server/db/app.ts';
import { findOriginal, originalUrl, serveOriginal } from '#lib/server/original.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.admin) error(404);
	const row = await findOriginal(db(), params.id);
	if (!row) error(404);
	if (params.filename !== row.filename) redirect(308, originalUrl(params.id, row.filename));
	return (await serveOriginal(row)) ?? error(404);
};
