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
