// 페어링 관리 화면의 탭·항목 타입. 서버(조회)와 클라이언트(무한 스크롤·카드)가 같이 쓴다. 서버 전용 코드 금지.
export type PairTab = 'review' | 'auto' | 'confirmed' | 'unpaired';
export const PAIR_TABS: readonly PairTab[] = ['review', 'auto', 'confirmed', 'unpaired'];
export const PAIR_TAB_LABEL: Record<PairTab, string> = {
	review: '검토 필요',
	auto: '자동 묶임 · 미확정',
	confirmed: '확정',
	unpaired: '원본 없는 보정본'
};
export function parseTab(v: string | null | undefined): PairTab {
	return (PAIR_TABS as readonly string[]).includes(v ?? '') ? (v as PairTab) : 'review';
}

export type Thumb = {
	id: string;
	filename: string;
	relPath: string;
	thumb: string;
	preview: string;
	source: string;
	takenAt: string | null;
	camera: string | null;
};
/** 묶인 보정본 한 장 (자동 / 확정 탭). cursor 는 이 항목 다음 페이지를 부를 때 쓰는 키셋 */
export type PairItem = {
	kind: 'pair';
	photoId: string;
	edit: Thumb;
	original: Thumb;
	score: number | null;
	method: string | null;
	confirmed: boolean;
	cursor: string;
};
/** 검토 후보 (보정본, 원본 후보) 한 쌍 */
export type ReviewItem = {
	kind: 'review';
	edit: Thumb;
	original: Thumb;
	score: number;
	method: string;
	cursor: string;
};
export type UnpairedItem = { kind: 'unpaired'; edit: Thumb; cursor: string };
export type PairListItem = PairItem | ReviewItem | UnpairedItem;
export type PairPage = { items: PairListItem[]; nextCursor: string | null };
