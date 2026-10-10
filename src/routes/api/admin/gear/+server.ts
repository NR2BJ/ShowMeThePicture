// 장비 순서 저장 (관리자만 — hooks 가 /api/admin 을 막는다). body: { ids: string[] } — 한 종류의 전체 id 를 새 순서대로.
import { json } from '@sveltejs/kit';
import { db } from '#lib/server/db/app.ts';
import { reorderGear } from '#lib/server/gear.ts';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const body = (await request.json().catch(() => null)) as { ids?: unknown } | null;
	const ids = Array.isArray(body?.ids)
		? body.ids.filter((x): x is string => typeof x === 'string')
		: [];
	if (ids.length === 0 || ids.length > 500) return json({ error: 'ids' }, { status: 400 });
	const n = await reorderGear(db(), ids);
	return json({ ok: true, updated: n });
};
