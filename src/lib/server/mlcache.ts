// ml 컨테이너가 받아 둔 모델 캐시(ml-cache 볼륨, /cache/clip/<모델>/{textual,visual}) 보기·지우기.
// app 에 그 볼륨이 ML_CACHE_DIR 로 마운트돼 있을 때만 동작한다.
import path from 'node:path';
import { opendir, rm, stat } from 'node:fs/promises';

export type ModelCache = { name: string; bytes: number; textual: boolean; visual: boolean };

async function dirSize(dir: string): Promise<number> {
	let total = 0;
	let dh;
	try {
		dh = await opendir(dir);
	} catch {
		return 0;
	}
	for await (const ent of dh) {
		const p = path.join(dir, ent.name);
		if (ent.isDirectory()) total += await dirSize(p);
		else if (ent.isFile()) total += (await stat(p).catch(() => null))?.size ?? 0;
	}
	return total;
}

const exists = (p: string) =>
	stat(p).then(
		() => true,
		() => false
	);

/** 받아 둔 CLIP 모델들 (이름순). 디렉터리가 없거나 못 읽으면 null (= 마운트 안 됨). */
export async function listModelCaches(root: string | undefined): Promise<ModelCache[] | null> {
	if (!root) return null;
	const clip = path.join(root, 'clip');
	let dh;
	try {
		dh = await opendir(clip);
	} catch {
		return (await exists(root)) ? [] : null;
	}
	const out: ModelCache[] = [];
	for await (const ent of dh) {
		if (!ent.isDirectory() || ent.name.startsWith('.')) continue;
		const dir = path.join(clip, ent.name);
		out.push({
			name: ent.name,
			bytes: await dirSize(dir),
			textual: await exists(path.join(dir, 'textual')),
			visual: await exists(path.join(dir, 'visual'))
		});
	}
	return out.sort((a, b) => a.name.localeCompare(b.name));
}

/** 모델 캐시 폴더 삭제. 이름에 경로 문자가 있으면 거부. ml 이 메모리에 올려 둔 것은 그대로고 다음 요청 때 다시 받는다. */
export async function deleteModelCache(root: string | undefined, name: string): Promise<boolean> {
	if (!root || !/^[A-Za-z0-9._-]+$/.test(name)) return false;
	const dir = path.join(root, 'clip', name);
	if (!(await exists(dir))) return false;
	await rm(dir, { recursive: true, force: true });
	return true;
}
