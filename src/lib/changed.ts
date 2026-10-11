// 사진 페이지에서 바꾼 사진(방향·공개·컷 등) id 를 잠깐 기억해 둔다 — 아카이브·폴더 피드가 뒤로 가기로 되살아날 때
// 그 사진만 새로 받아 썸네일·딱지를 바꿔 끼운다(되살린 목록에는 예전 썸네일 주소가 들어 있다). 서버 전용 코드 금지.
const KEY = 'smtp:changed-photos';

export function markChanged(id: string): void {
	try {
		const cur = new Set<string>(JSON.parse(sessionStorage.getItem(KEY) ?? '[]'));
		cur.add(id);
		sessionStorage.setItem(KEY, JSON.stringify([...cur].slice(-200)));
	} catch {
		/* 저장소를 못 쓰면 새로고침으로만 갱신된다 */
	}
}

export function takeChanged(): string[] {
	try {
		const ids = JSON.parse(sessionStorage.getItem(KEY) ?? '[]') as string[];
		sessionStorage.removeItem(KEY);
		return Array.isArray(ids) ? ids : [];
	} catch {
		return [];
	}
}
