import { fail } from '@sveltejs/kit';
import { db } from '#lib/server/db/app.ts';
import {
	applyAllFolderDates,
	applyFolderDates,
	listFolderMeta,
	updateFolderMeta
} from '#lib/server/folders.ts';
import { listGear } from '#lib/server/gear.ts';
import type { Actions, PageServerLoad } from './$types';

/** ?tab=pending(미확정: 폴더명에서 자동으로 읽은 것) | confirmed(관리자가 저장한 것). 폼의 action 에 tab 을 실어 저장 뒤에도 같은 탭. */
export const load: PageServerLoad = async ({ url }) => {
	const gear = await listGear(db());
	const folders = await listFolderMeta(db());
	const tab = url.searchParams.get('tab') === 'confirmed' ? 'confirmed' : 'pending';
	return {
		folders,
		tab,
		gear: {
			camera: gear.filter((g) => g.kind === 'camera').map((g) => g.name),
			lens: gear.filter((g) => g.kind === 'lens').map((g) => g.name),
			film: gear.filter((g) => g.kind === 'film').map((g) => g.name)
		}
	};
};

const str = (v: FormDataEntryValue | null) => {
	const s = String(v ?? '').trim();
	return s ? s : null;
};

export const actions: Actions = {
	applyAll: async () => {
		const r = await applyAllFolderDates(db());
		return { all: r };
	},
	save: async ({ request }) => {
		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		if (!id) return fail(400, { error: 'id' });
		const month = str(form.get('developedAt')); // YYYY-MM
		const developedAt =
			month && /^\d{4}-\d{2}$/.test(month)
				? `${month}-01`
				: month && /^\d{4}-\d{2}-\d{2}$/.test(month)
					? month
					: null;
		const rollNoRaw = str(form.get('rollNo'));
		const row = await updateFolderMeta(db(), id, {
			title: str(form.get('title')),
			developedAt,
			rollNo: rollNoRaw ? Number(rollNoRaw) : null,
			camera: str(form.get('camera')),
			lens: str(form.get('lens')),
			filmStock: str(form.get('filmStock')),
			filmFormat: str(form.get('filmFormat')),
			scanner: str(form.get('scanner')),
			notes: str(form.get('notes'))
		});
		if (!row) return fail(404, { error: 'not found' });
		const applied = await applyFolderDates(db(), row.sourceId, row.relDir);
		return { saved: id, applied, title: row.title ?? row.relDir, hasDate: !!row.developedAt };
	}
};
