// 검색 모델 목록 (설정 드롭다운). Immich ML 모델 zoo 의 이름 그대로. 서버 전용 코드 금지.
// 숫자는 Immich 문서의 벤치(한국어 질의 recall %, CPU f32 기준 상주 메모리) — 가속기에서는 메모리가 다르다.
export const DEFAULT_SEARCH_MODEL = 'ViT-B-16-SigLIP2__webli';
export const SEARCH_MODELS: { id: string; label: string; note: string }[] = [
	{
		id: 'ViT-B-16-SigLIP2__webli',
		label: 'SigLIP2 B/16',
		note: '한국어 71 · 3.0GB · 가벼움 · 기본'
	},
	{ id: 'ViT-L-16-SigLIP2-256__webli', label: 'SigLIP2 L/16', note: '한국어 75 · 2.8GB · 중간' },
	{
		id: 'ViT-SO400M-16-SigLIP2-384__webli',
		label: 'SigLIP2 SO400M 384',
		note: '한국어 77 · 3.9GB · A380 OpenVINO 에서 사진 모델 실행 실패(2026-10 확인)'
	},
	{
		id: 'nllb-clip-base-siglip__v1',
		label: 'NLLB-CLIP base',
		note: '한국어 77 · 4.7GB · 번역 모델 텍스트 인코더 · 언어 코드 필요 · A380 에서 올라옴'
	},
	{
		id: 'nllb-clip-large-siglip__v1',
		label: 'NLLB-CLIP large',
		note: '한국어 81 · 4.2GB+ · A380 OpenVINO 에서 사진 모델 실행 실패(2026-10 확인) · 언어 코드 필요'
	},
	{
		id: 'XLM-Roberta-Large-ViT-H-14__frozen_laion5b_s13b_b90k',
		label: 'XLM-R CLIP H/14',
		note: '한국어 74 · 4.0GB · 구세대 다국어'
	},
	{
		id: 'ViT-B-16-SigLIP-i18n-256__webli',
		label: 'SigLIP(1) i18n B/16',
		note: '한국어 69 · 3.0GB · SigLIP2 에 밀림'
	}
];
export const needsLanguage = (model: string) => model.startsWith('nllb');

/** 검색 결과 나누기: 가장 가까운 사진 대비 유사도가 RELEVANCE_RATIO 미만이면 '관련도 낮음'으로 접는다 (최소 MIN_STRONG 장은 보여줌).
 *  유사도 = 1 − 코사인 거리. 모델마다 절대값이 달라 상대 기준을 쓴다. */
export const RELEVANCE_RATIO = 0.55;
export const MIN_STRONG = 6;
export function splitByRelevance<T extends { dist: number }>(
	items: T[]
): { strong: T[]; weak: T[]; top: number; cut: number } {
	if (items.length === 0) return { strong: [], weak: [], top: 0, cut: 0 };
	const sims = items.map((i) => 1 - i.dist);
	const top = sims[0];
	const cut = top > 0 ? top * RELEVANCE_RATIO : -Infinity;
	let n = 0;
	for (const s of sims) if (s >= cut) n++;
	n = Math.max(Math.min(MIN_STRONG, items.length), n);
	return { strong: items.slice(0, n), weak: items.slice(n), top, cut };
}

/** 코사인 유사도 (정규화 안 된 벡터도 됨). 길이가 다르면 짧은 쪽까지만. */
export function cosine(a: number[], b: number[]): number {
	const n = Math.min(a.length, b.length);
	let dot = 0,
		na = 0,
		nb = 0;
	for (let i = 0; i < n; i++) {
		dot += a[i] * b[i];
		na += a[i] * a[i];
		nb += b[i] * b[i];
	}
	return na > 0 && nb > 0 ? dot / Math.sqrt(na * nb) : 0;
}

/** 허브 보정 유사도: sim − cq·(ai − abar). cq = cos(질의, 라이브러리 중심), ai = cos(사진, 중심), abar = ai 의 평균.
 *  중심 방향 성분이 평균보다 큰 사진(회색 벽·흐린 컷처럼 내용이 없어 모든 질의에 조금씩 끼는 허브)은 깎이고,
 *  작은 사진은 조금 오른다. server/search.ts 의 SQL 과 같은 식 — 테스트용 기준 구현. */
export const hubAdjust = (sim: number, cq: number, ai: number, abar: number) =>
	sim - cq * (ai - abar);
