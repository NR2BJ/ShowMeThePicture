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
