import path from 'node:path';
import type { SizeName } from '#lib/media.ts';

/** cache/{id[:2]}/{id}/{size}.webp */
export function derivativePath(cacheDir: string, fileId: string, size: SizeName): string {
	return path.join(cacheDir, fileId.slice(0, 2).toLowerCase(), fileId, `${size}.webp`);
}

export function derivativeDir(cacheDir: string, fileId: string): string {
	return path.join(cacheDir, fileId.slice(0, 2).toLowerCase(), fileId);
}
