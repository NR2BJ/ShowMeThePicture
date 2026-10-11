// 검색에서 연 사진의 이전/다음: 검색 페이지가 보여 준 순서(관련도 높은 묶음 → 접힌 묶음)를 잠깐 기억해 두고 따라간다.
// 캐시에 없으면(서버 재시작, 링크로 바로 들어옴) 같은 검색을 다시 돌린다. ML 이 없으면 이전/다음 없이.
import { splitByRelevance } from '#lib/search.ts';
import { searchParams, type SearchState } from '#lib/searchctx.ts';
import type { Db } from './db';
import { searchByText, type SearchResult } from './search';

const TTL_MS = 30 * 60_000;
const MAX = 100;
const cache = new Map<string, { at: number; ids: string[] }>();

const keyOf = (s: SearchState, admin: boolean) =>
	`${admin ? 'a' : 'g'}|${searchParams(s).toString()}`;

/** 화면에 보이는 순서: 관련도 높은 것 먼저, 접힌 것은 그 뒤 (search/+page.svelte 와 같은 분할) */
export function displayOrder(r: SearchResult): string[] {
	const split = splitByRelevance(r.items, r.mean);
	return [...split.strong, ...split.weak].map((h) => h.id);
}

export function rememberSearch(s: SearchState, admin: boolean, r: SearchResult): void {
	cache.set(keyOf(s, admin), { at: Date.now(), ids: displayOrder(r) });
	if (cache.size > MAX) cache.delete(cache.keys().next().value as string);
}

export async function searchNeighbors(
	db: Db,
	s: SearchState,
	admin: boolean,
	photoId: string
): Promise<{ prev: string | null; next: string | null }> {
	const key = keyOf(s, admin);
	let hit = cache.get(key);
	if (!hit || Date.now() - hit.at > TTL_MS) {
		try {
			const r = await searchByText(db, {
				admin,
				text: s.q,
				limit: 60,
				order: s.order,
				filter: s.filter
			});
			rememberSearch(s, admin, r);
			hit = cache.get(key);
		} catch (e) {
			console.error('[search-nav]', e);
			return { prev: null, next: null };
		}
	}
	const ids = hit?.ids ?? [];
	const i = ids.indexOf(photoId);
	if (i < 0) return { prev: null, next: null };
	return { prev: ids[i - 1] ?? null, next: ids[i + 1] ?? null };
}
