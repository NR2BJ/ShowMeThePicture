import { hit, isLimited } from '#lib/server/ratelimit.ts';
import type { RequestHandler } from './$types';

/** 브라우저 오류 보고(hooks.client.ts) → 서버 로그. 저장은 안 한다. IP 당 10분 30건까지. */
export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	let ip = 'unknown';
	try {
		ip = getClientAddress();
	} catch {
		/* 무시 */
	}
	const key = `client-error:${ip}`;
	if (isLimited(key, 30)) return new Response(null, { status: 204 });
	hit(key, 10 * 60_000);
	try {
		const b = (await request.json()) as Record<string, unknown>;
		const s = (v: unknown, n: number) => String(v ?? '').slice(0, n);
		console.error(
			`[client-error ${s(b.id, 12)}] ${s(b.kind, 10)} ${s(b.path, 300)} route=${s(b.route, 100)} ua=${s(b.ua, 200)}\n  ${s(b.message, 500)}\n  ${s(b.stack, 2000)}`
		);
	} catch {
		/* 형식이 틀린 보고는 버린다 */
	}
	return new Response(null, { status: 204 });
};
