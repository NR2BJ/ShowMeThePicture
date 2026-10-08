import { config } from '#lib/server/config.ts';
import { db } from '#lib/server/db/app.ts';
import { listPhotos, type GalleryItem } from '#lib/server/gallery.ts';
import { getSetting } from '#lib/server/settings.ts';
import type { PageServerLoad } from './$types';

const LIMIT = 120;

export type MonthGroup = { key: string; label: string; items: GalleryItem[] };

export const load: PageServerLoad = async ({ url, locals }) => {
	const admin = !!locals.admin;
	const page = Math.max(1, Number(url.searchParams.get('page') ?? '1') || 1);
	if (!config.DATABASE_URL)
		return {
			groups: [] as MonthGroup[],
			page,
			hasMore: false,
			total: 0,
			includeB: false,
			canToggleB: false,
			noDb: true
		};
	const policy = await getSetting<'hidden' | 'toggle' | 'public'>(db(), 'b_cut_policy', 'hidden');
	const canToggleB = admin || policy === 'toggle';
	const includeB = policy === 'public' || (canToggleB && url.searchParams.get('b') === '1');
	const { items, hasMore, total } = await listPhotos(db(), {
		scope: { kind: 'archive' },
		admin,
		includeB,
		page,
		limit: LIMIT
	});
	const groups: MonthGroup[] = [];
	const fmt = new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long' });
	for (const it of items) {
		const key = it.takenAt ? it.takenAt.slice(0, 7) : 'unknown';
		let g = groups[groups.length - 1];
		if (!g || g.key !== key) {
			g = { key, label: it.takenAt ? fmt.format(new Date(it.takenAt)) : '날짜 없음', items: [] };
			groups.push(g);
		}
		g.items.push(it);
	}
	return { groups, page, hasMore, total, includeB, canToggleB, noDb: false };
};
