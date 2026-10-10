// 장비 등록(카메라·렌즈·필름)과 문자열 매칭. 폴더명에서 등록된 장비를 찾고, 폼에서는 드롭다운으로 고른다.
import { asc, eq } from 'drizzle-orm';
import type { Db } from './db';
import { gear } from './db/schema';

export type GearKind = 'camera' | 'lens' | 'film';
export type GearRow = typeof gear.$inferSelect;
export type GearItem = {
	kind: GearKind;
	name: string;
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
 * 장비 이름에서 폴더명에 나올 법한 열쇠들을 만든다 (별칭 대신).
 *  - 이름 전체 (공백·대소문자 무시): "Kodak ColorPlus 200" → kodakcolorplus200
 *  - 앞 단어(브랜드)들을 뺀 나머지: colorplus200, 200 (5자 이상에 글자가 있어야 — "200" 같은 숫자만은 제외)
 *  - 뒤 단어들을 뺀 앞부분: kodakcolorplus (단어 2개 이상)
 *  - 유독 긴 단어 하나: colorplus, ultramax, sunkissed (6자 이상 글자 단어 중 가장 긴 것)
 * 긴 열쇠가 먼저 잡히므로 "Kodak Gold 200" 폴더에 ColorPlus 가 붙는 일은 없다 (gold200 만 Gold 에 맞음).
 */
export function gearKeys(name: string): string[] {
	const tokens = name
		.normalize('NFC')
		.split(/[\s\-_.·'’]+/)
		.map((t) => norm(t))
		.filter(Boolean);
	const keys = new Set<string>();
	const ok = (k: string, minLen: number) => k.length >= minLen && /[a-z가-힣]/.test(k);
	if (tokens.length === 0) return [];
	keys.add(tokens.join(''));
	for (let i = 1; i < tokens.length; i++) {
		const k = tokens.slice(i).join('');
		if (ok(k, 5)) keys.add(k);
	}
	for (let j = tokens.length - 1; j >= 2; j--) {
		const k = tokens.slice(0, j).join('');
		if (ok(k, 5)) keys.add(k);
	}
	const longest = [...tokens].filter((t) => ok(t, 6)).sort((a, b) => b.length - a.length)[0];
	if (longest) keys.add(longest);
	return [...keys].filter((k) => k.length >= 2);
}

/**
 * 문자열에서 등록된 장비를 찾는다. 긴 열쇠부터 시도해 "Kodak ColorPlus 200" 이 "Kodak" 보다 먼저 잡히게.
 * 찾은 토큰은 rest 에서 제거한다. 고정렌즈 카메라는 렌즈를 같이 채운다.
 */
export function matchGear(text: string, items: GearItem[]): GearMatch {
	const out: GearMatch = { camera: null, lens: null, filmStock: null, rest: text.trim() };
	const n = norm(text);
	const used: { start: number; end: number }[] = [];
	const candidates = items
		.flatMap((g) => gearKeys(g.name).map((key) => ({ g, key })))
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
	return rows.map((r) => ({ kind: r.kind, name: r.name, fixedLens: r.fixedLens }));
}

export async function addGear(
	db: Db,
	input: {
		kind: GearKind;
		name: string;
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
				fixedLens: input.fixedLens,
				format: input.format,
				notes: input.notes,
				updatedAt: new Date()
			}
		})
		.returning();
	return row;
}

export async function updateGear(
	db: Db,
	id: string,
	patch: {
		name: string;
		fixedLens: string | null;
		format: string | null;
		notes: string | null;
	}
): Promise<GearRow | null> {
	const [row] = await db
		.update(gear)
		.set({ ...patch, updatedAt: new Date() })
		.where(eq(gear.id, id))
		.returning();
	return row ?? null;
}

/** 같은 종류 안에서 한 칸 위/아래로. 그 종류의 position 을 0..n-1 로 다시 매긴다. */
export async function moveGear(db: Db, id: string, dir: 'up' | 'down'): Promise<boolean> {
	const [me] = await db.select({ kind: gear.kind }).from(gear).where(eq(gear.id, id)).limit(1);
	if (!me) return false;
	const rows = await db
		.select({ id: gear.id })
		.from(gear)
		.where(eq(gear.kind, me.kind))
		.orderBy(asc(gear.position), asc(gear.name));
	const ids = rows.map((r) => r.id);
	const i = ids.indexOf(id);
	const j = dir === 'up' ? i - 1 : i + 1;
	if (i < 0 || j < 0 || j >= ids.length) return false;
	[ids[i], ids[j]] = [ids[j], ids[i]];
	for (let k = 0; k < ids.length; k++)
		await db.update(gear).set({ position: k }).where(eq(gear.id, ids[k]));
	return true;
}

export async function deleteGear(db: Db, id: string): Promise<void> {
	await db.delete(gear).where(eq(gear.id, id));
}
