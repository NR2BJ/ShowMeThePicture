// 페어링 관리 API (관리자만 — hooks 가 /api/admin 을 막는다). GET: 탭 페이지, POST: 한 건 조작(JSON).
import { json } from '@sveltejs/kit';
import { parseTab } from '#lib/pairs.ts';
import { db } from '#lib/server/db/app.ts';
import { PAIR_PAGE, listPairTab, runPairAction, type PairAction } from '#lib/server/pairs-admin.ts';
import type { RequestHandler } from './$types';

const headers = { 'cache-control': 'private, no-store' };

export const GET: RequestHandler = async ({ url }) => {
	const tab = parseTab(url.searchParams.get('tab'));
	const cursor = url.searchParams.get('cursor');
	const limitRaw = Number(url.searchParams.get('limit') ?? PAIR_PAGE);
	const limit = Number.isInteger(limitRaw) ? Math.min(200, Math.max(1, limitRaw)) : PAIR_PAGE;
	return json(await listPairTab(db(), tab, cursor, limit), { headers });
};

export const POST: RequestHandler = async ({ request }) => {
	const body = (await request.json().catch(() => null)) as PairAction | null;
	if (!body || typeof body !== 'object' || !('action' in body))
		return json({ error: 'bad request' }, { status: 400, headers });
	const r = await runPairAction(db(), body);
	return r.ok
		? json({ ok: true, message: r.message }, { headers })
		: json({ error: r.error }, { status: r.status, headers });
};
