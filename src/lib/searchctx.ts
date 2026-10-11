// 검색 주소와 사진 페이지 ctx — 검색어·보기(order)·필터를 한 군데서 만들고 읽는다. 서버 전용 코드 금지.
import { filterParams, parseFilter, type ArchiveFilter } from './archive';

export type SearchOrder = 'mix' | 'score';
export type SearchState = { q: string; order: SearchOrder; filter: ArchiveFilter };

export function parseSearch(params: URLSearchParams): SearchState {
	return {
		q: (params.get('q') ?? '').trim().slice(0, 200),
		// 예전 관리자용 &raw=1 주소도 점수순으로
		order: params.get('order') === 'score' || params.get('raw') === '1' ? 'score' : 'mix',
		filter: parseFilter(params)
	};
}

export function searchParams(s: SearchState): URLSearchParams {
	const p = new URLSearchParams();
	if (s.q) p.set('q', s.q);
	if (s.order === 'score') p.set('order', 'score');
	for (const [k, v] of filterParams(s.filter)) p.set(k, v);
	return p;
}

export function searchHref(s: SearchState): string {
	const q = searchParams(s).toString();
	return q ? `/search?${q}` : '/search';
}

/** 사진 페이지 prev/next 가 검색 결과 순서를 따라가도록: 'search:<query>' */
export function searchCtx(s: SearchState): string {
	return `search:${searchParams(s).toString()}`;
}
export function searchFromCtx(ctx: string): SearchState | null {
	return ctx.startsWith('search:') ? parseSearch(new URLSearchParams(ctx.slice(7))) : null;
}
