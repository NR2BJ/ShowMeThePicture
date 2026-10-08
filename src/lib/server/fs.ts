// 원본 루트(/photos) 아래만 다루는 파일시스템 유틸. 클라이언트가 준 경로는 전부 여기로 검증한다.
import { opendir } from 'node:fs/promises';
import path from 'node:path';

export const RAW_EXTS = new Set([
	'srw',
	'nef',
	'arw',
	'cr2',
	'cr3',
	'raf',
	'dng',
	'orf',
	'rw2',
	'pef',
	'x3f'
]);
export const IMAGE_EXTS = new Set([
	'jpg',
	'jpeg',
	'png',
	'tif',
	'tiff',
	'webp',
	'heic',
	'heif',
	...RAW_EXTS
]);
/** 스캔에서 건너뛰는 디렉터리 */
const IGNORED_DIRS = new Set([
	'@eaDir',
	'#recycle',
	'#snapshot',
	'.Trash',
	'lost+found',
	'node_modules'
]);

export type FileKind = 'raw' | 'jpeg' | 'tiff' | 'png' | 'webp' | 'heic' | 'other';

export function extOf(name: string): string {
	const i = name.lastIndexOf('.');
	return i < 0 ? '' : name.slice(i + 1).toLowerCase();
}

export function kindOf(ext: string): FileKind {
	if (RAW_EXTS.has(ext)) return 'raw';
	if (ext === 'jpg' || ext === 'jpeg') return 'jpeg';
	if (ext === 'tif' || ext === 'tiff') return 'tiff';
	if (ext === 'png') return 'png';
	if (ext === 'webp') return 'webp';
	if (ext === 'heic' || ext === 'heif') return 'heic';
	return 'other';
}

export function isIgnoredDir(name: string): boolean {
	return name.startsWith('.') || IGNORED_DIRS.has(name);
}

export class PathEscapeError extends Error {}

/** root 안의 상대 경로를 절대 경로로. root 밖으로 나가면 throw. */
export function safeResolve(root: string, rel: string): string {
	const base = path.resolve(root);
	const target = path.resolve(base, rel || '.');
	if (target !== base && !target.startsWith(base + path.sep))
		throw new PathEscapeError(`path escapes root: ${rel}`);
	return target;
}

export type DirListing = {
	rel: string;
	dirs: { name: string; rel: string }[];
	imageCount: number;
};

/** 하위 디렉터리와 이 폴더의 이미지 개수(재귀 아님). 폴더 선택기용. */
export async function listDir(root: string, rel: string): Promise<DirListing> {
	const abs = safeResolve(root, rel);
	const dirs: { name: string; rel: string }[] = [];
	let imageCount = 0;
	const dh = await opendir(abs);
	for await (const ent of dh) {
		if (ent.isDirectory()) {
			if (!isIgnoredDir(ent.name))
				dirs.push({ name: ent.name, rel: path.posix.join(rel, ent.name) });
		} else if (ent.isFile() && IMAGE_EXTS.has(extOf(ent.name))) {
			imageCount++;
		}
	}
	dirs.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
	return { rel: rel.replace(/^\/+/, ''), dirs, imageCount };
}
