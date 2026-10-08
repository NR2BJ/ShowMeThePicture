// <img use:fadeIn>: 로드가 끝나면 .loaded 를 붙인다. SSR 된 이미지가 hydration 전에 이미 로드된 경우도 잡는다
// (onload 만 쓰면 그 경우 영원히 opacity 0 으로 남는다).
export function fadeIn(img: HTMLImageElement) {
	const done = () => img.classList.add('loaded');
	if (img.complete && img.naturalWidth > 0) done();
	else img.addEventListener('load', done, { once: true });
	return {
		destroy() {
			img.removeEventListener('load', done);
		}
	};
}
