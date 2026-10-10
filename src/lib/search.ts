// 검색 모델 목록 (설정 드롭다운). Immich ML 모델 zoo 의 이름 그대로. 서버 전용 코드 금지.
// 한국어 숫자는 Immich 문서의 벤치(한국어 질의 recall %). 목록에 없는 값이 저장돼 있으면 '(예전 값)'으로 남는다.
// Intel Arc(A380) + OpenVINO: 사진 쪽이 SO400M 인 모델은 기본 모델 파일(main)로는 추론이 "Unable to cast reference" 로 실패한다.
// Immich ML v3.3 이상 + MACHINE_LEARNING_MODEL_REVISION=v2 (새 변환본)면 돈다 — immich-app/immich#32035, 사용자 서버에서 확인(2026-10).
export const DEFAULT_SEARCH_MODEL = 'ViT-SO400M-16-SigLIP2-384__webli';
export const SEARCH_MODELS: { id: string; label: string; note: string }[] = [
	{
		id: 'ViT-SO400M-16-SigLIP2-384__webli',
		label: 'SigLIP2 SO400M 384',
		note: '한국어 77 · 기본 · Intel Arc 는 ML 에 MODEL_REVISION=v2 필요'
	},
	{
		id: 'nllb-clip-large-siglip__v1',
		label: 'NLLB-CLIP large',
		note: '한국어 81 · 질의 언어 코드 사용 · Intel Arc 는 v2 필요 · A380 미확인'
	},
	{
		id: 'ViT-L-16-SigLIP2-256__webli',
		label: 'SigLIP2 L/16',
		note: '한국어 75 · 가벼운 대안 · 어느 설정에서나 돈다'
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
	// 순서는 건드리지 않고 유사도로만 가른다 — 다양성 재정렬 뒤에는 목록이 유사도순이 아니다
	const sims = items.map((i) => 1 - i.dist);
	const top = Math.max(...sims);
	// 1등이 평균 아래면 전부 '관련도 낮음' (최소 장수만 보여줌)
	const cut = top > baseline ? baseline + (top - baseline) * RELEVANCE_RATIO : Infinity;
	const keep = new Set<number>();
	sims.forEach((s, i) => s >= cut && keep.add(i));
	// 최소 장수: 유사도 높은 순으로 채운다
	const need = Math.min(MIN_STRONG, items.length);
	if (keep.size < need)
		for (const i of sims
			.map((s, i) => [s, i])
			.sort((x, y) => y[0] - x[0])
			.map((x) => x[1])) {
			if (keep.size >= need) break;
			keep.add(i);
		}
	return {
		strong: items.filter((_, i) => keep.has(i)),
		weak: items.filter((_, i) => !keep.has(i)),
		top,
		cut
	};
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

/** 비슷한 컷 묶기: 순위순으로 보며 앞서 남긴 대표 컷과 코사인이 threshold 이상이면 그 대표 밑에 넣는다.
 *  대표하고만 비교한다 — single-linkage 는 사슬로 다른 장면까지 한 덩어리로 만든다. 셔터를 연달아 눌러 거의 같은 컷만 묶는 게 목적이라
 *  기준이 높다(같은 무대에서 사람·동작이 바뀐 사진은 묶지 않고 다양성 재정렬이 뒤로 미룬다). threshold ≤ 0 이면 끔. dup 은 묶인 장수. */
export const DEFAULT_DUP_THRESHOLD = 0.97;
/** 예전 기본값들. 설정 저장 때 자동으로 같이 저장된 값이라 사용자가 고른 게 아니므로 새 기본값으로 읽는다. */
export const LEGACY_DUP_DEFAULTS = [0.85, 0.92];
export function collapseNearDuplicates<T extends { vec: number[] }>(
	items: T[],
	threshold: number
): { kept: (T & { dup: number })[]; collapsed: number } {
	if (!(threshold > 0)) return { kept: items.map((it) => ({ ...it, dup: 0 })), collapsed: 0 };
	const groups: { rep: T; n: number }[] = [];
	for (const it of items) {
		const g = groups.find((g) => cosine(g.rep.vec, it.vec) >= threshold);
		if (g) g.n++;
		else groups.push({ rep: it, n: 0 });
	}
	return {
		kept: groups.map((g) => ({ ...g.rep, dup: g.n })),
		collapsed: items.length - groups.length
	};
}

/** 다양성 재정렬 (MMR 변형). 한 장씩 고를 때 점수 = 질의 관련도(z) − strength × Σ(이미 고른 사진과 겹침).
 *  겹침 w = max(0, (cos − T) / (1 − T)) — T 는 후보끼리 코사인의 90 백분위라 모델마다 값의 범위가 달라도 '같은 장면'만 걸린다.
 *  같은 장면이 몇 장 나오면 다음 컷은 점점 뒤로 밀리고, 사이에 다른 장면이 올라온다. 아무것도 빼지 않는다.
 *  strength ≤ 0 이면 원래 순서. mean/std 는 질의 유사도의 라이브러리 분포(z 로 바꿔 겹침과 단위를 맞춘다). */
export const DEFAULT_DIVERSITY = 0.5;
export function diversify<T extends { vec: number[]; dist: number }>(
	items: T[],
	strength: number,
	mean: number,
	std: number
): T[] {
	const n = items.length;
	if (!(strength > 0) || n < 3) return items;
	const cos: number[][] = items.map(() => new Array<number>(n).fill(0));
	const pairs: number[] = [];
	for (let i = 0; i < n; i++)
		for (let j = i + 1; j < n; j++) {
			const c = cosine(items[i].vec, items[j].vec);
			cos[i][j] = cos[j][i] = c;
			pairs.push(c);
		}
	pairs.sort((x, y) => x - y);
	const T = Math.min(0.99, pairs[Math.floor(pairs.length * 0.9)]);
	const rel = items.map((it) => (std > 0 ? (1 - it.dist - mean) / std : 1 - it.dist));
	const penalty = new Array<number>(n).fill(0);
	const left = new Set(items.map((_, i) => i));
	const out: T[] = [];
	while (left.size) {
		let best = -1;
		let bestScore = -Infinity;
		for (const i of left) {
			const sc = rel[i] - strength * penalty[i];
			if (sc > bestScore) {
				bestScore = sc;
				best = i;
			}
		}
		left.delete(best);
		out.push(items[best]);
		for (const i of left) penalty[i] += Math.max(0, (cos[best][i] - T) / (1 - T));
	}
	return out;
}
