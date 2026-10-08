// 파생본(webp), thumbhash, pHash. sharp(libvips) 기반.
import { mkdir, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { rgbaToThumbHash } from 'thumbhash';
import { SIZES, type SizeName } from '#lib/media.ts';
import { derivativeDir, derivativePath } from '#lib/server/media.ts';

export type DeriveResult = { width: number; height: number; thumbhash: Buffer; phash: Buffer };

/** 32×32 그레이스케일 → DCT → 저주파 8×8 → 중앙값 기준 64bit */
export function phashFromGray32(gray: Uint8Array): Buffer {
	const N = 32;
	const cos = new Float64Array(N * N);
	for (let u = 0; u < N; u++)
		for (let x = 0; x < N; x++) cos[u * N + x] = Math.cos(((2 * x + 1) * u * Math.PI) / (2 * N));
	const tmp = new Float64Array(N * N);
	for (let y = 0; y < N; y++)
		for (let u = 0; u < 8; u++) {
			let s = 0;
			for (let x = 0; x < N; x++) s += gray[y * N + x] * cos[u * N + x];
			tmp[y * N + u] = s;
		}
	const vals: number[] = [];
	for (let v = 0; v < 8; v++)
		for (let u = 0; u < 8; u++) {
			let s = 0;
			for (let y = 0; y < N; y++) s += tmp[y * N + u] * cos[v * N + y];
			vals.push(s);
		}
	const sorted = vals.slice(1).sort((a, b) => a - b);
	const median = sorted[Math.floor(sorted.length / 2)];
	const out = Buffer.alloc(8);
	for (let i = 0; i < 64; i++) if (vals[i] > median) out[i >> 3] |= 0x80 >> (i & 7);
	return out;
}

export function hamming(a: Uint8Array, b: Uint8Array): number {
	let d = 0;
	for (let i = 0; i < a.length; i++) {
		let x = a[i] ^ b[i];
		while (x) {
			d += x & 1;
			x >>= 1;
		}
	}
	return d;
}

/**
 * 입력(원본 또는 RAW 내장 프리뷰) → thumb/preview/full webp + thumbhash + pHash.
 * 색은 ICC 를 반영해 sRGB 로 변환하고(AdobeRGB/ProPhoto 대응), EXIF 방향을 적용한다.
 */
export async function deriveAll(
	input: string,
	cacheDir: string,
	fileId: string,
	fullEdge: number = SIZES.full
): Promise<DeriveResult> {
	const base = sharp(input, { failOn: 'none', limitInputPixels: false }).rotate();
	const meta = await base.metadata();
	const oriented = (meta.orientation ?? 1) >= 5;
	const width = oriented ? (meta.height ?? 0) : (meta.width ?? 0);
	const height = oriented ? (meta.width ?? 0) : (meta.height ?? 0);

	const dir = derivativeDir(cacheDir, fileId);
	await mkdir(dir, { recursive: true });

	const sizes: Record<SizeName, number> = {
		thumb: SIZES.thumb,
		preview: SIZES.preview,
		full: fullEdge
	};
	for (const name of Object.keys(sizes) as SizeName[]) {
		const edge = sizes[name];
		const out = derivativePath(cacheDir, fileId, name);
		const tmp = `${out}.tmp-${process.pid}`;
		await base
			.clone()
			.resize({ width: edge, height: edge, fit: 'inside', withoutEnlargement: true })
			.withIccProfile('srgb')
			.webp({ quality: name === 'thumb' ? 78 : 84, effort: 4 })
			.toFile(tmp);
		await rename(tmp, out);
	}

	const small = await base
		.clone()
		.resize({ width: 100, height: 100, fit: 'inside' })
		.withIccProfile('srgb')
		.ensureAlpha()
		.raw()
		.toBuffer({ resolveWithObject: true });
	const thumbhash = Buffer.from(rgbaToThumbHash(small.info.width, small.info.height, small.data));

	const gray = await base.clone().greyscale().resize(32, 32, { fit: 'fill' }).raw().toBuffer();
	const phash = phashFromGray32(gray);

	return { width, height, thumbhash, phash };
}

export async function removeDerivatives(cacheDir: string, fileId: string): Promise<void> {
	await rm(derivativeDir(cacheDir, fileId), { recursive: true, force: true });
}

export const TMP_PREVIEW_SUFFIX = '.preview.jpg';
export function tmpPreviewPath(cacheDir: string, fileId: string): string {
	return path.join(derivativeDir(cacheDir, fileId), `source${TMP_PREVIEW_SUFFIX}`);
}

export { derivativeDir as derivativeDirSafe };
