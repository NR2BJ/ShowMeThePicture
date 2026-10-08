// 워커용 파생본 생성: 미리 만드는 사이즈(thumb/preview) + thumbhash + pHash.
// full(2560) 은 기본적으로 누가 열 때 /media 가 만든다 (EAGER_FULL=1 이면 여기서 미리).
import { rgbaToThumbHash } from 'thumbhash';
import { SIZES, type SizeName } from '#lib/media.ts';
import { basePipeline, renderSize } from '#lib/server/derive.ts';

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

export type DeriveOptions = { eager: SizeName[]; fullEdge: number; rotation?: number };

/**
 * 입력(원본 또는 RAW 내장 프리뷰) → 지정한 사이즈 webp + thumbhash + pHash.
 * 색은 ICC 를 반영해 sRGB 로, EXIF 방향은 적용.
 */
export async function deriveAll(
	input: string,
	cacheDir: string,
	fileId: string,
	opts: DeriveOptions
): Promise<DeriveResult> {
	const rotation = (opts.rotation ?? 0) % 4;
	const base = basePipeline(input, rotation);
	const meta = await base.metadata();
	// EXIF 방향을 반영한 크기 → 추가 회전이 홀수면 가로세로 교환
	let width = meta.autoOrient?.width ?? meta.width ?? 0;
	let height = meta.autoOrient?.height ?? meta.height ?? 0;
	if (rotation % 2) [width, height] = [height, width];

	for (const size of opts.eager) {
		await renderSize(base, cacheDir, fileId, size, size === 'full' ? opts.fullEdge : SIZES[size]);
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

export { removeDerivatives } from '#lib/server/derivefs.ts';
