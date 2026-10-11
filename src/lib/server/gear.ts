// 장비 등록(카메라·렌즈·필름)과 문자열 매칭. 폴더명에서 등록된 장비를 찾고, 폼에서는 드롭다운으로 고른다.
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import type { Db } from './db';
import { files, folderMeta, gear, gearNames, photos } from './db/schema';

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
	await rebuildGearNames(db);
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
	await rebuildGearNames(db);
	return row ?? null;
}

/** 끌어서 바꾼 순서 저장: 주어진 id 순서대로 position 0..n-1 (한 종류의 전체 목록이어야 한다). */
export async function reorderGear(db: Db, ids: string[]): Promise<number> {
	let n = 0;
	for (let k = 0; k < ids.length; k++) {
		const r = await db
			.update(gear)
			.set({ position: k })
			.where(eq(gear.id, ids[k]))
			.returning({ id: gear.id });
		n += r.length;
	}
	return n;
}

export async function deleteGear(db: Db, id: string): Promise<void> {
	await db.delete(gear).where(eq(gear.id, id));
	await rebuildGearNames(db);
}

// ---- EXIF·폴더 이름 → 등록 장비 대응표 (gear_names) ----

/** raw 이름이 이 종류의 어떤 등록 장비와 같은지 (비슷하면 같은 것으로) */
function mapOne(raw: string, kind: 'camera' | 'lens', rows: GearRow[]): GearRow | null {
	const pool = rows.filter((r) => r.kind === kind);
	const exact = pool.find((r) => norm(r.name) === norm(raw));
	if (exact) return exact;
	const m = matchGear(raw, toItems(pool));
	const name = kind === 'camera' ? m.camera : m.lens;
	return name ? (pool.find((r) => r.name === name) ?? null) : null;
}

/** 대응표를 처음부터 다시 만든다 — 장비를 추가·수정·삭제했을 때, 롤 정보를 바꿨을 때, 스캔이 끝났을 때 */
export async function rebuildGearNames(db: Db): Promise<number> {
	const rows = await listGear(db);
	const raws = async (kind: 'camera' | 'lens') => {
		const col = kind === 'camera' ? files.cameraModel : files.lens;
		const fm = kind === 'camera' ? folderMeta.camera : folderMeta.lens;
		const a = await db
			.selectDistinct({ v: col })
			.from(files)
			.where(sql`${col} is not null`);
		const b = await db
			.selectDistinct({ v: fm })
			.from(folderMeta)
			.where(sql`${fm} is not null`);
		const c = (await db.execute(
			sql`select distinct ${photos.metaOverride}->>${kind} as v from ${photos} where ${photos.metaOverride}->>${kind} is not null`
		)) as unknown as { v: string }[];
		return [...new Set([...a, ...b, ...c].map((r) => r.v).filter((v): v is string => !!v?.trim()))];
	};
	const out: { kind: 'camera' | 'lens'; raw: string; gearId: string }[] = [];
	for (const kind of ['camera', 'lens'] as const)
		for (const raw of await raws(kind)) {
			const g = mapOne(raw, kind, rows);
			if (g) out.push({ kind, raw, gearId: g.id });
		}
	await db.transaction(async (tx) => {
		await tx.delete(gearNames);
		for (let i = 0; i < out.length; i += 500)
			await tx.insert(gearNames).values(out.slice(i, i + 500));
	});
	return out.length;
}

/** 새로 처리한 파일의 EXIF 이름만 대응표에 더한다 (전체 다시 만들기는 스캔 끝에) */
export async function mapGearNames(
	db: Db,
	names: { camera: string | null; lens: string | null }
): Promise<void> {
	const rows = await listGear(db);
	for (const kind of ['camera', 'lens'] as const) {
		const raw = names[kind]?.trim();
		if (!raw) continue;
		const g = mapOne(raw, kind, rows);
		if (g)
			await db
				.insert(gearNames)
				.values({ kind, raw, gearId: g.id })
				.onConflictDoUpdate({ target: [gearNames.kind, gearNames.raw], set: { gearId: g.id } });
	}
}

/** 사진 페이지용: 유효 카메라·렌즈 이름을 등록 이름으로, 렌즈가 비면 카메라의 고정렌즈 */
export async function resolveGear(
	db: Db,
	camera: string | null,
	lens: string | null
): Promise<{ camera: string | null; lens: string | null; lensFromGear: boolean }> {
	const raws = [camera, lens].filter((v): v is string => !!v);
	const maps = raws.length
		? await db
				.select({
					kind: gearNames.kind,
					raw: gearNames.raw,
					name: gear.name,
					fixedLens: gear.fixedLens
				})
				.from(gearNames)
				.innerJoin(gear, eq(gear.id, gearNames.gearId))
				.where(inArray(gearNames.raw, raws))
		: [];
	const cam = camera ? maps.find((m) => m.kind === 'camera' && m.raw === camera) : undefined;
	const len = lens ? maps.find((m) => m.kind === 'lens' && m.raw === lens) : undefined;
	let fixed: string | null = cam?.fixedLens ?? null;
	if (!fixed && camera && !cam) {
		const [g] = await db
			.select({ fixedLens: gear.fixedLens })
			.from(gear)
			.where(and(eq(gear.kind, 'camera'), eq(gear.name, camera)))
			.limit(1);
		fixed = g?.fixedLens ?? null;
	}
	const outLens = len?.name ?? lens ?? fixed;
	return { camera: cam?.name ?? camera, lens: outLens, lensFromGear: !lens && !!fixed };
}
