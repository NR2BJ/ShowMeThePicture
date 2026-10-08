// 파생본 생성 (app 과 worker 공용). worker 는 thumb/preview 를 미리 만들고,
// full 은 누가 그 사진을 열 때 /media 라우트가 여기로 만든다 (SSD 용량 절약).
import { mkdir, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import type { ExifTool } from 'exiftool-vendored';
import sharp, { type Sharp } from 'sharp';
import { SIZES, type SizeName } from '#lib/media.ts';
import { derivativeDir, derivativePath } from './media';

export const QUALITY: Record<SizeName, number> = { thumb: 78, preview: 84, full: 84 };

export type SourceFile = { id: string; kind: string; absPath: string; rotation?: number };

/** RAW 면 내장 프리뷰를 꺼내 임시 JPG 경로를, 아니면 원본 경로를 돌려준다. */
export async function openSource(
	exiftool: ExifTool,
	cacheDir: string,
	file: SourceFile
): Promise<{ input: string; cleanup: () => Promise<void> }> {
	if (file.kind !== 'raw') return { input: file.absPath, cleanup: async () => {} };
	const dir = derivativeDir(cacheDir, file.id);
	await mkdir(dir, { recursive: true });
	const tmp = path.join(dir, `source-${process.pid}.preview.jpg`);
	await rm(tmp, { force: true });
	// 카메라마다 내장 JPEG 태그가 다르다: Panasonic/Leica 는 JpgFromRaw, Samsung/Sony/Nikon 등은 PreviewImage,
	// 일부는 OtherImage. 전부 없으면 ThumbnailImage 라도 쓴다 (작지만 깨지진 않게).
	const errors: string[] = [];
	let ok = false;
	for (const tag of ['JpgFromRaw', 'PreviewImage', 'OtherImage', 'ThumbnailImage']) {
		try {
			await exiftool.extractBinaryTag(tag, file.absPath, tmp);
			const st = await stat(tmp).catch(() => null);
			if (st && st.size > 1024) {
				ok = true;
				break;
			}
			errors.push(`${tag}: empty`);
		} catch (e) {
			errors.push(`${tag}: ${e instanceof Error ? e.message.split('\n')[0] : String(e)}`);
		}
	}
	if (!ok) throw new Error(`RAW 내장 프리뷰를 꺼내지 못했습니다 (${errors.join(' / ')})`);
	return { input: tmp, cleanup: () => rm(tmp, { force: true }) };
}

/** EXIF 자동 회전 + 관리자 추가 회전(시계 방향 90° × rotation) */
export function basePipeline(input: string, rotation = 0): Sharp {
	const s = sharp(input, { failOn: 'none', limitInputPixels: false }).autoOrient();
	return rotation % 4 ? s.rotate((rotation % 4) * 90) : s;
}

/** 한 사이즈를 webp 로 렌더 (임시 파일 → rename 으로 원자적 교체). */
export async function renderSize(
	base: Sharp,
	cacheDir: string,
	fileId: string,
	size: SizeName,
	edge: number
): Promise<string> {
	const out = derivativePath(cacheDir, fileId, size);
	await mkdir(path.dirname(out), { recursive: true });
	const tmp = `${out}.tmp-${process.pid}-${Date.now()}`;
	await base
		.clone()
		.resize({ width: edge, height: edge, fit: 'inside', withoutEnlargement: true })
		.withIccProfile('srgb')
		.webp({ quality: QUALITY[size], effort: 4 })
		.toFile(tmp);
	await rename(tmp, out);
	return out;
}

const inflight = new Map<string, Promise<string>>();

/** 파생본이 없으면 만든다. 같은 파일 요청이 겹치면 한 번만 만든다. */
export async function ensureDerivative(
	exiftool: ExifTool,
	cacheDir: string,
	file: SourceFile,
	size: SizeName,
	edge: number = SIZES[size]
): Promise<string> {
	const out = derivativePath(cacheDir, file.id, size);
	if (
		await stat(out).then(
			() => true,
			() => false
		)
	)
		return out;
	const key = `${file.id}:${size}`;
	let p = inflight.get(key);
	if (!p) {
		p = (async () => {
			const src = await openSource(exiftool, cacheDir, file);
			try {
				return await renderSize(
					basePipeline(src.input, file.rotation ?? 0),
					cacheDir,
					file.id,
					size,
					edge
				);
			} finally {
				await src.cleanup();
				inflight.delete(key);
			}
		})();
		inflight.set(key, p);
	}
	return p;
}
