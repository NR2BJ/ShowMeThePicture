// use:autoRefresh={ms} — 페이지 데이터를 주기적으로 다시 불러온다 (관리자 화면의 처리 진행 숫자용).
// 탭이 숨겨져 있으면 쉬고, 다시 보이면 바로 한 번 갱신한다.
import { invalidateAll } from '$app/navigation';

export function autoRefresh(_node: HTMLElement, ms: number = 5000) {
	let timer: ReturnType<typeof setInterval> | null = null;
	const tick = () => {
		if (document.visibilityState === 'visible') invalidateAll();
	};
	const start = (interval: number) => {
		if (timer) clearInterval(timer);
		timer = setInterval(tick, interval);
	};
	const onVis = () => {
		if (document.visibilityState === 'visible') tick();
	};
	document.addEventListener('visibilitychange', onVis);
	start(ms);
	return {
		update(next: number) {
			start(next);
		},
		destroy() {
			if (timer) clearInterval(timer);
			document.removeEventListener('visibilitychange', onVis);
		}
	};
}
