import { config } from '#lib/server/config.ts';
import { db } from '#lib/server/db/app.ts';
import { hit, isLimited } from '#lib/server/ratelimit.ts';
import { isBot, recordVisit } from '#lib/server/visits.ts';
import type { RequestHandler } from './$types';

const none = () => new Response(null, { status: 204 });

/**
 * 방문 기록 신호. 브라우저가 페이지를 실제로 몇 초 보고 있을 때만 보낸다(src/lib/visit.ts) —
 * 자바스크립트를 안 돌리는 스캐너·크롤러·링크 미리보기 봇은 여기까지 오지 않는다.
 * 본문: { "site": true } 또는 { "photo": "<사진 id>" }. 응답은 늘 204 (결과를 알려 주지 않는다).
 */
export const POST: RequestHandler = async ({ request, locals, getClientAddress }) => {
	if (!config.DATABASE_URL || locals.admin) return none();
	const ua = request.headers.get('user-agent') ?? '';
	if (isBot(ua)) return none();
	let ip = 'unknown';
	try {
		ip = getClientAddress();
	} catch {
		/* 주소를 못 얻으면 브라우저 정보만으로 */
	}
	const key = `visit:${ip}`;
	if (isLimited(key, 300)) return none();
	hit(key, 10 * 60_000);
	let body: { site?: unknown; photo?: unknown };
	try {
		body = await request.json();
	} catch {
		return none();
	}
	try {
		if (body.site === true) await recordVisit(db(), { target: 'site', ip, ua });
		else if (typeof body.photo === 'string' && /^[0-9A-Z]{26}$/.test(body.photo))
			await recordVisit(db(), { target: { photoId: body.photo }, ip, ua });
	} catch (e) {
		console.error('[visit]', e instanceof Error ? e.message : e);
	}
	return none();
};
