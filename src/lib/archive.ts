// 아카이브 월 묶음 — 서버(히스토그램)와 클라이언트(무한 스크롤 그룹화)가 같이 쓴다. 서버 전용 코드 금지.
import type { GalleryItem } from './server/gallery';

export const UNKNOWN_MONTH = 'unknown';
export type MonthBucket = { key: string; count: number }; // key: 'YYYY-MM' | 'unknown'
export type MonthGroup = { key: string; label: string; items: GalleryItem[] };

const fmts = new Map<string, Intl.DateTimeFormat>();
function fmtFor(zone: string): Intl.DateTimeFormat {
	let f = fmts.get(zone);
	if (!f) {
		f = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit' });
		fmts.set(zone, f);
	}
	return f;
}

/** ISO 시각 → 'YYYY-MM' (zone 기준). 날짜 없음은 'unknown'. */
export function monthKey(iso: string | null, zone: string): string {
	if (!iso) return UNKNOWN_MONTH;
	try {
		const parts = fmtFor(zone).formatToParts(new Date(iso));
		const y = parts.find((p) => p.type === 'year')?.value;
		const m = parts.find((p) => p.type === 'month')?.value;
		return y && m ? `${y}-${m}` : UNKNOWN_MONTH;
	} catch {
		return iso.slice(0, 7);
	}
}

export function monthLabel(key: string): string {
	if (key === UNKNOWN_MONTH) return '날짜 없음';
	const [y, m] = key.split('-');
	return `${y}년 ${Number(m)}월`;
}

export function isMonthKey(s: string | null | undefined): s is string {
	return !!s && (/^\d{4}-(0[1-9]|1[0-2])$/.test(s) || s === UNKNOWN_MONTH);
}

/** 날짜 내림차순 목록을 연속된 월 구간으로 묶는다. */
export function groupByMonth(items: GalleryItem[], zone: string): MonthGroup[] {
	const groups: MonthGroup[] = [];
	for (const it of items) {
		const key = monthKey(it.takenAt, zone);
		let g = groups[groups.length - 1];
		if (!g || g.key !== key) {
			g = { key, label: monthLabel(key), items: [] };
			groups.push(g);
		}
		g.items.push(it);
	}
	return groups;
}

// ---- 필터 ----
export const MEDIUMS = ['film', 'digital'] as const;
export type MediumKey = (typeof MEDIUMS)[number];
export const KINDS = ['A', 'B', 'original'] as const;
export type KindKey = (typeof KINDS)[number];
export const MEDIUM_LABEL: Record<MediumKey, string> = { film: '필름', digital: '디지털' };
export const KIND_LABEL: Record<KindKey, string> = { A: 'A컷', B: 'B컷', original: '원본만' };

/** 아카이브 필터. 비어 있으면 전체. medium/kind 는 집합(비면 전체), camera/lens/film 은 유효 장비와 정확히 일치. */
export type ArchiveFilter = {
	medium?: MediumKey[];
	kind?: KindKey[];
	camera?: string;
	lens?: string;
	film?: string;
};
export type FacetValue = { v: string; n: number };
/** 각 축의 선택지별 장수 — 그 축 자신의 필터는 빼고, 나머지 필터는 적용한 값 */
export type ArchiveFacets = {
	medium: Record<MediumKey, number>;
	kind: Record<KindKey, number>;
	camera: FacetValue[];
	lens: FacetValue[];
	film: FacetValue[];
};

function pickList<T extends string>(raw: string | null, allowed: readonly T[]): T[] | undefined {
	if (!raw) return undefined;
	const vals = allowed.filter((a) => raw.split(',').includes(a));
	// 전부 고른 건 필터 없음과 같다
	return vals.length === 0 || vals.length === allowed.length ? undefined : vals;
}

export function parseFilter(params: URLSearchParams): ArchiveFilter {
	const f: ArchiveFilter = {};
	const m = pickList(params.get('medium'), MEDIUMS);
	if (m) f.medium = m;
	const k = pickList(params.get('kind'), KINDS);
	if (k) f.kind = k;
	for (const key of ['camera', 'lens', 'film'] as const) {
		const v = params.get(key)?.trim();
		if (v) f[key] = v.slice(0, 200);
	}
	return f;
}

export function filterParams(f: ArchiveFilter): URLSearchParams {
	const p = new URLSearchParams();
	if (f.medium?.length) p.set('medium', f.medium.join(','));
	if (f.kind?.length) p.set('kind', f.kind.join(','));
	for (const key of ['camera', 'lens', 'film'] as const) if (f[key]) p.set(key, f[key]);
	return p;
}

export function isFilterActive(f: ArchiveFilter): boolean {
	return filterParams(f).toString().length > 0;
}

/** /archive 주소: 필터 + 추가 파라미터(from 등) */
export function archiveHref(
	f: ArchiveFilter,
	extra?: Record<string, string | null | undefined>
): string {
	const p = filterParams(f);
	for (const [k, v] of Object.entries(extra ?? {})) if (v) p.set(k, v);
	const q = p.toString();
	return q ? `/archive?${q}` : '/archive';
}

/** 사진 페이지 prev/next 가 같은 목록을 따라가도록 ctx 에 필터를 싣는다: 'archive' | 'archive:<query>' */
export function archiveCtx(f: ArchiveFilter): string {
	const q = filterParams(f).toString();
	return q ? `archive:${q}` : 'archive';
}
export function filterFromCtx(ctx: string): ArchiveFilter {
	return ctx.startsWith('archive:')
		? parseFilter(new URLSearchParams(ctx.slice('archive:'.length)))
		: {};
}
