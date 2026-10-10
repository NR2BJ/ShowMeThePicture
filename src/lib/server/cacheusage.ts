// 캐시 폴더 사용량. 수만 개 디렉터리를 걷는 일이라 10분 메모.
import { opendir, stat } from 'node:fs/promises';
import path from 'node:path';

export type CacheUsage = {
	bytes: number;
	files: number;
	bySize: Record<string, number>;
	measuredAt: number;
};

let memo: CacheUsage | null = null;
let pending: Promise<CacheUsage> | null = null;
const TTL = 10 * 60_000;

async function walk(dir: string, acc: CacheUsage): Promise<void> {
	let dh;
	try {
		dh = await opendir(dir);
	} catch {
		return;
	}
	for await (const ent of dh) {
		const p = path.join(dir, ent.name);
		if (ent.isDirectory()) await walk(p, acc);
		else if (ent.isFile()) {
			const st = await stat(p).catch(() => null);
			if (!st) continue;
			acc.bytes += st.size;
			acc.files++;
			const key = ent.name.replace(/\.webp$/, '');
			if (key === 'thumb' || key === 'preview' || key === 'full')
				acc.bySize[key] = (acc.bySize[key] ?? 0) + st.size;
		}
	}
}

/** 캐시 디렉터리가 있는 디스크의 남은 공간 (바이트). ML 모델 캐시·DB 볼륨도 보통 같은 디스크라 이걸로 본다. */
export async function diskFree(dir: string): Promise<number | null> {
	try {
		const { statfs } = await import('node:fs/promises');
		const st = await statfs(dir);
		return Number(st.bavail) * Number(st.bsize);
	} catch {
		return null;
	}
}

export async function getCacheUsage(cacheDir: string, force = false): Promise<CacheUsage> {
	if (!force && memo && Date.now() - memo.measuredAt < TTL) return memo;
	if (!pending) {
		pending = (async () => {
			const acc: CacheUsage = { bytes: 0, files: 0, bySize: {}, measuredAt: Date.now() };
			await walk(cacheDir, acc);
			memo = acc;
			pending = null;
			return acc;
		})();
	}
	return pending;
}

export function fmtBytes(n: number): string {
	if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
	if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
	return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
