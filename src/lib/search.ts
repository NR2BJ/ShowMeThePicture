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

/** 검색 결과 나누기: 라이브러리 평균(baseline) 위로 1등이 올라간 폭의 RELEVANCE_RATIO 에 못 미치면 '관련도 낮음'으로 접는다
 *  (최소 MIN_STRONG 장은 보여줌). 유사도 = 1 − 코사인 거리. 0 이 아니라 평균에서 재는 이유: SigLIP2 처럼 값이 좁은 띠
 *  (예: 0.06~0.14)에 몰리는 모델은 0 기준 55% 로는 아무것도 접히지 않는다. */
export const RELEVANCE_RATIO = 0.55;
export const MIN_STRONG = 6;
export function splitByRelevance<T extends { dist: number }>(
	items: T[],
	baseline = 0
): { strong: T[]; weak: T[]; top: number; cut: number } {
	if (items.length === 0) return { strong: [], weak: [], top: 0, cut: 0 };
	const sims = items.map((i) => 1 - i.dist);
	const top = sims[0];
	// 1등이 평균 아래면 전부 '관련도 낮음' (최소 장수만 보여줌)
	const cut = top > baseline ? baseline + (top - baseline) * RELEVANCE_RATIO : Infinity;
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

/** 비슷한 컷 묶기: 순위순으로 보며 앞서 남긴 사진(또는 그 묶음의 어느 컷)과 코사인이 threshold 이상이면 그 묶음에 넣는다
 *  (single-linkage — 연사처럼 조금씩 다른 컷이 사슬로 이어져도 한 묶음). 같은 무대·같은 배경 연사 수십 장이 결과를 메우는 걸 막는다.
 *  threshold ≤ 0 이면 묶지 않는다. 대표는 묶음에서 순위가 가장 높은 컷, dup 은 묶인 나머지 장수. */
export const DEFAULT_DUP_THRESHOLD = 0.85;
export function collapseNearDuplicates<T extends { vec: number[] }>(
	items: T[],
	threshold: number
): { kept: (T & { dup: number })[]; collapsed: number } {
	if (!(threshold > 0)) return { kept: items.map((it) => ({ ...it, dup: 0 })), collapsed: 0 };
	const groups: { rep: T; members: T[] }[] = [];
	for (const it of items) {
		const g = groups.find((g) => g.members.some((m) => cosine(m.vec, it.vec) >= threshold));
		if (g) g.members.push(it);
		else groups.push({ rep: it, members: [it] });
	}
	return {
		kept: groups.map((g) => ({ ...g.rep, dup: g.members.length - 1 })),
		collapsed: items.length - groups.length
	};
}
