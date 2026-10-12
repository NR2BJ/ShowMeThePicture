// 방문 신호(브라우저 쪽). 페이지가 화면에 보이는 채로 잠깐 머물렀을 때만 서버에 알린다.
// 같은 브라우저는 하루 한 번(사이트), 사진마다 하루 한 번만 보낸다. 관리자로 로그인한 적 있는 브라우저는 아예 안 센다.
const KEY = 'smtp:visit';
const ME = 'smtp:me';
const DWELL_MS = 2000;
const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo' });

type Seen = { day: string; site: boolean; photos: string[] };

function load(): Seen {
	const day = dayFmt.format(new Date());
	try {
		const s = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Seen | null;
		if (s && s.day === day) return s;
	} catch {
		/* 저장소를 못 쓰면 서버의 하루 중복 방지만 믿는다 */
	}
	return { day, site: false, photos: [] };
}
function save(s: Seen) {
	try {
		localStorage.setItem(KEY, JSON.stringify(s));
	} catch {
		/* 무시 */
	}
}

/** 관리자 브라우저 표시 — 로그아웃한 뒤에도 내 방문은 안 센다 */
export function markMe(): void {
	try {
		localStorage.setItem(ME, '1');
	} catch {
		/* 무시 */
	}
}
function isMe(): boolean {
	try {
		return localStorage.getItem(ME) === '1';
	} catch {
		return false;
	}
}

function send(body: object) {
	void fetch('/api/visit', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(body),
		keepalive: true
	}).catch(() => {});
}

/** 화면에 보이는 채로 ms 동안 머물면 fn. 돌려준 함수로 취소(페이지·사진이 바뀔 때). */
function afterDwell(fn: () => void, ms = DWELL_MS): () => void {
	let left = ms;
	let started = 0;
	let timer: ReturnType<typeof setTimeout> | null = null;
	const start = () => {
		if (timer || document.visibilityState !== 'visible') return;
		started = Date.now();
		timer = setTimeout(() => {
			cleanup();
			fn();
		}, left);
	};
	const pause = () => {
		if (!timer) return;
		clearTimeout(timer);
		timer = null;
		left -= Date.now() - started;
	};
	const onVis = () => (document.visibilityState === 'visible' ? start() : pause());
	const cleanup = () => {
		if (timer) clearTimeout(timer);
		timer = null;
		document.removeEventListener('visibilitychange', onVis);
	};
	document.addEventListener('visibilitychange', onVis);
	start();
	return cleanup;
}

function eligible(): boolean {
	return !isMe() && !navigator.webdriver;
}

/** 사이트 방문 한 번 (하루 한 번) */
export function countVisit(): () => void {
	if (!eligible() || load().site) return () => {};
	return afterDwell(() => {
		const s = load();
		if (s.site) return;
		send({ site: true });
		save({ ...s, site: true });
	});
}

/** 사진 조회 한 번 (사진마다 하루 한 번) */
export function countPhotoView(photoId: string): () => void {
	if (!eligible() || load().photos.includes(photoId)) return () => {};
	return afterDwell(() => {
		const s = load();
		if (s.photos.includes(photoId)) return;
		send({ photo: photoId });
		save({ ...s, photos: [...s.photos, photoId].slice(-500) });
	});
}
