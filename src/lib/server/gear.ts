// 장비 등록(카메라·렌즈·필름)과 문자열 매칭. 폴더명에서 등록된 장비를 찾고, 폼에서는 드롭다운으로 고른다.
import { asc, eq } from 'drizzle-orm';
import type { Db } from './db';
import { gear } from './db/schema';

export type GearKind = 'camera' | 'lens' | 'film';
export type GearRow = typeof gear.$inferSelect;
export type GearItem = {
	kind: GearKind;
	name: string;
	aliases: string[];
	fixedLens: string | null;
};

/** 비교용 정규화: 소문자, 공백·하이픈·언더스코어·점 제거 */
export function norm(s: string): string {
	return s
		.normalize('NFC')
		.toLowerCase()
		.replace(/[\s\-_.·]/g, '');
}

export type GearMatch = {
	camera: string | null;
	lens: string | null;
	filmStock: string | null;
	rest: string;
};

/**
 * 문자열에서 등록된 장비를 찾는다. 긴 이름부터 시도해 "Kodak ColorPlus 200" 이 "Kodak" 보다 먼저 잡히게.
 * 찾은 토큰은 rest 에서 제거한다. 고정렌즈 카메라는 렌즈를 같이 채운다.
 */
export function matchGear(text: string, items: GearItem[]): GearMatch {
	const out: GearMatch = { camera: null, lens: null, filmStock: null, rest: text.trim() };
	const n = norm(text);
	const used: { start: number; end: number }[] = [];
	const candidates = items
		.flatMap((g) => [g.name, ...g.aliases].map((a) => ({ g, key: norm(a) })))
		.filter((c) => c.key.length >= 2)
		.sort((a, b) => b.key.length - a.key.length);
	const consumed = new Set<string>();
	for (const c of candidates) {
		if (consumed.has(c.g.kind)) continue;
		const i = n.indexOf(c.key);
		if (i < 0) continue;
		if (used.some((u) => i < u.end && i + c.key.length > u.start)) continue;
		used.push({ start: i, end: i + c.key.length });
		consumed.add(c.g.kind);
		if (c.g.kind === 'camera') {
			out.camera = c.g.name;
			if (c.g.fixedLens && !out.lens) out.lens = c.g.fixedLens;
		} else if (c.g.kind === 'lens') out.lens = c.g.name;
		else out.filmStock = c.g.name;
	}
	// rest: 원문에서 매칭된 글자들을 지운다 (정규화 좌표를 원문으로 되돌리기 어렵기 때문에 토큰 단위로 처리)
	if (used.length) {
		const tokens = text.trim().split(/\s+/);
		const keep: string[] = [];
		let acc = '';
		for (const t of tokens) {
			const nt = norm(t);
			const pos = acc.length;
			acc += nt;
			const inside =
				used.some((u) => pos >= u.start && pos + nt.length <= u.end) ||
				used.some((u) => pos < u.end && pos + nt.length > u.start);
			if (!inside) keep.push(t);
		}
		out.rest = keep.join(' ').replace(/^[\s\-–·]+|[\s\-–·]+$/g, '');
	}
	return out;
}

export async function listGear(db: Db): Promise<GearRow[]> {
	return db.select().from(gear).orderBy(asc(gear.kind), asc(gear.position), asc(gear.name));
}

export function toItems(rows: GearRow[]): GearItem[] {
	return rows.map((r) => ({
		kind: r.kind,
		name: r.name,
		aliases: r.aliases ?? [],
		fixedLens: r.fixedLens
	}));
}

export async function addGear(
	db: Db,
	input: {
		kind: GearKind;
		name: string;
		aliases: string[];
		fixedLens: string | null;
		format: string | null;
		notes: string | null;
	}
): Promise<GearRow> {
	const [row] = await db
		.insert(gear)
		.values({ ...input })
		.onConflictDoUpdate({
			target: [gear.kind, gear.name],
			set: {
				aliases: input.aliases,
				fixedLens: input.fixedLens,
				format: input.format,
				notes: input.notes,
				updatedAt: new Date()
			}
		})
		.returning();
	return row;
}

export async function deleteGear(db: Db, id: string): Promise<void> {
	await db.delete(gear).where(eq(gear.id, id));
}
