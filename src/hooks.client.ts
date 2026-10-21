import type { HandleClientError } from '@sveltejs/kit/hooks';

/**
 * 브라우저에서 난 예상 못 한 오류(화면 이동 중 load·컴포넌트 오류 등): 서버 로그에 남도록 /api/client-error 로 보낸다.
 * 서버 쪽 오류와 달리 이건 원래 서버 로그에 아무것도 안 남아, 운영에서 보인 500 의 원인을 찾을 수 없었다.
 */
export const handleError: HandleClientError = ({ kind, error, event }) => {
	// 예상 못 한 오류만 보고한다 (404 같은 프레임워크 오류·error() 로 던진 오류는 제외)
	if (kind !== 'unknown') return;
	const id = Math.random().toString(36).slice(2, 8);
	try {
		const e = error instanceof Error ? error : new Error(String(error));
		void fetch('/api/client-error', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			keepalive: true,
			body: JSON.stringify({
				id,
				kind,
				message: e.message.slice(0, 500),
				stack: (e.stack ?? '').slice(0, 2000),
				path: event.url.pathname + event.url.search,
				route: event.route.id,
				ua: navigator.userAgent.slice(0, 200)
			})
		}).catch(() => {});
	} catch {
		/* 보고 실패는 무시 */
	}
	return { id };
};
