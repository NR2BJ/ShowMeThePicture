import { describe, expect, it } from 'vitest';
import {
	archiveCtx,
	archiveHref,
	filterFromCtx,
	filterParams,
	groupByMonth,
	monthKey,
	monthLabel,
	parseFilter
} from './archive';
import { collapseNearDuplicates, cosine, hubAdjust, splitByRelevance } from './search';
import type { GalleryItem } from './server/gallery';

const sp = (q: string) => new URLSearchParams(q);

describe('parseFilter', () => {
	it('집합 축: 하나만 고르면 필터, 전부 고르면 전체', () => {
		expect(parseFilter(sp('medium=film'))).toEqual({ medium: ['film'] });
		expect(parseFilter(sp('medium=film,digital'))).toEqual({});
		expect(parseFilter(sp('kind=B,A'))).toEqual({ kind: ['A', 'B'] });
		expect(parseFilter(sp('kind=A,A,zzz'))).toEqual({ kind: ['A'] });
		expect(parseFilter(sp('kind=zzz'))).toEqual({});
	});
	it('장비 축: 공백 제거, 빈 값 무시', () => {
		expect(parseFilter(sp('camera=%20NX500%20&lens=&film=Kodak+ColorPlus+200'))).toEqual({
			camera: 'NX500',
			film: 'Kodak ColorPlus 200'
		});
	});
	it('주소·ctx 왕복', () => {
		const f = parseFilter(sp('medium=film&kind=A,original&camera=Rollei 35S'));
		expect(parseFilter(filterParams(f))).toEqual(f);
		expect(filterFromCtx(archiveCtx(f))).toEqual(f);
		expect(archiveCtx({})).toBe('archive');
		expect(filterFromCtx('archive')).toEqual({});
		expect(filterFromCtx('library:film')).toEqual({});
		expect(archiveHref({})).toBe('/archive');
		expect(archiveHref({ medium: ['film'] }, { from: '2025-09' })).toBe(
			'/archive?medium=film&from=2025-09'
		);
	});
});

describe('splitByRelevance', () => {
	const mk = (sims: number[]) => sims.map((s, i) => ({ id: String(i), dist: 1 - s }));
	it('folds results far below the best match, keeping at least six', () => {
		const r = splitByRelevance(mk([0.3, 0.28, 0.2, 0.17, 0.1, 0.08, 0.05, 0.04]));
		expect(r.strong.map((x) => x.id)).toEqual(['0', '1', '2', '3', '4', '5']); // 6 보장 (0.165 기준이면 4개)
		expect(r.weak.length).toBe(2);
		const r2 = splitByRelevance(mk([0.3, 0.29, 0.28, 0.27, 0.26, 0.25, 0.24, 0.23, 0.05]));
		expect(r2.strong.length).toBe(8);
		expect(r2.weak.length).toBe(1);
	});
	it('handles empty and tiny lists', () => {
		expect(splitByRelevance([]).strong).toEqual([]);
		expect(splitByRelevance(mk([0.1, 0.01])).strong.length).toBe(2);
	});
	it('기준은 라이브러리 평균에서 잰다 — 값이 좁은 띠에 몰린 모델(SigLIP2)도 접힌다', () => {
		const sims = [0.14, 0.13, 0.12, 0.11, 0.1, 0.09, 0.085, 0.08, 0.08];
		expect(splitByRelevance(mk(sims)).weak.length).toBe(0); // 0 기준 55% = 0.077 → 아무것도 안 접힘
		const r = splitByRelevance(mk(sims), 0.07); // 평균 0.07: 0.07 + 0.07·0.55 = 0.1085
		expect(r.cut).toBeCloseTo(0.1085);
		expect(r.strong.length).toBe(6); // 기준 위는 4장이지만 최소 6
		expect(r.weak.length).toBe(3);
		expect(splitByRelevance(mk([0.05, 0.04]), 0.07).strong.length).toBe(2); // 1등이 평균 아래 → 최소 장수만
	});
});

describe('collapseNearDuplicates', () => {
	const v = (x: number, y: number) => [x, y];
	it('순위가 높은 컷이 대표, 사슬로 이어진 컷도 한 묶음', () => {
		// a≈b, b≈c (a 와 c 는 기준 미만이지만 b 를 통해 이어짐), d 는 다름
		const items = [
			{ id: 'a', vec: v(1, 0) },
			{ id: 'b', vec: v(0.98, 0.2) },
			{ id: 'c', vec: v(0.9, 0.44) },
			{ id: 'd', vec: v(0, 1) }
		];
		const r = collapseNearDuplicates(items, 0.95);
		expect(r.kept.map((k) => `${k.id}+${k.dup}`)).toEqual(['a+2', 'd+0']);
		expect(r.collapsed).toBe(2);
	});
	it('기준 0 이면 묶지 않는다', () => {
		const r = collapseNearDuplicates(
			[
				{ id: 'a', vec: v(1, 0) },
				{ id: 'b', vec: v(1, 0) }
			],
			0
		);
		expect(r.kept.map((k) => k.dup)).toEqual([0, 0]);
		expect(r.collapsed).toBe(0);
	});
});

describe('hub adjustment', () => {
	it('cosine handles unnormalized and zero vectors', () => {
		expect(cosine([1, 0], [0, 1])).toBe(0);
		expect(cosine([2, 0], [1, 0])).toBeCloseTo(1);
		expect(cosine([1, 1], [-1, -1])).toBeCloseTo(-1);
		expect(cosine([0, 0], [1, 0])).toBe(0);
	});
	it('같은 원시 유사도면 중심 성분이 큰(내용 없는) 사진이 뒤로 간다', () => {
		expect(hubAdjust(0.05, 0.1, 0.9, 0.7)).toBeLessThan(hubAdjust(0.05, 0.1, 0.5, 0.7));
		expect(hubAdjust(0.05, 0.1, 0.7, 0.7)).toBe(0.05); // 평균이면 그대로
		expect(hubAdjust(0.05, 0, 0.9, 0.7)).toBe(0.05); // 질의가 중심과 무관하면 보정 없음
	});
});

describe('month grouping', () => {
	it('시간대 기준으로 달을 자른다', () => {
		expect(monthKey('2025-08-31T20:00:00Z', 'Asia/Seoul')).toBe('2025-09');
		expect(monthKey('2025-08-31T20:00:00Z', 'UTC')).toBe('2025-08');
		expect(monthKey(null, 'UTC')).toBe('unknown');
		expect(monthLabel('2025-09')).toBe('2025년 9월');
		expect(monthLabel('unknown')).toBe('날짜 없음');
	});
	it('연속 구간으로 묶는다', () => {
		const item = (id: string, takenAt: string | null) => ({ id, takenAt }) as GalleryItem;
		const g = groupByMonth(
			[item('a', '2025-09-10T00:00:00Z'), item('b', '2025-09-01T00:00:00Z'), item('c', null)],
			'UTC'
		);
		expect(g.map((x) => [x.key, x.items.length])).toEqual([
			['2025-09', 2],
			['unknown', 1]
		]);
	});
});
