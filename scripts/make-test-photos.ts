// 로컬 테스트용 사진 세트 생성: data/test-photos/ 아래에 사용자의 실제 폴더 구조를 흉내 낸다.
//   pnpm tsx scripts/make-test-photos.ts
// 이미지는 합성(그라데이션+텍스트), EXIF 는 exiftool 로 기록. RAW 는 만들 수 없어 JPG 만.
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ExifTool } from 'exiftool-vendored';
import sharp from 'sharp';

const ROOT = path.resolve(process.argv[2] ?? 'data/test-photos');
const et = new ExifTool();

const shapes: [number, number][] = [
	[1800, 1200],
	[1200, 1800],
	[1500, 1500],
	[1920, 1080],
	[1800, 1200],
	[1800, 1200]
];
const palettes = [
	['#2b1d16', '#d9a65a'],
	['#0f2a3a', '#7fc8e8'],
	['#1d2b16', '#9fd97a'],
	['#3a0f1f', '#e87fa8'],
	['#2a2a2a', '#f1ece2'],
	['#0b1b2b', '#ffd27a']
];

async function makeImage(
	w: number,
	h: number,
	i: number,
	label: string,
	mono = false
): Promise<Buffer> {
	const [a, b] = palettes[i % palettes.length];
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
	<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>
	<rect width="100%" height="100%" fill="url(#g)"/>
	<circle cx="${w * 0.7}" cy="${h * 0.35}" r="${Math.min(w, h) * 0.18}" fill="${b}" opacity="0.6"/>
	<text x="${w * 0.06}" y="${h * 0.9}" font-family="monospace" font-size="${Math.min(w, h) * 0.07}" fill="#ffffff" opacity="0.85">${label}</text>
	</svg>`;
	let img = sharp(Buffer.from(svg));
	if (mono) img = img.greyscale();
	return img.jpeg({ quality: 90 }).toBuffer();
}

async function write(file: string, buf: Buffer) {
	await mkdir(path.dirname(file), { recursive: true });
	await writeFile(file, buf);
}

const made: string[] = [];
async function digital() {
	const days = ['2025-03-12', '2025-05-02'];
	let n = 1;
	for (const day of days) {
		for (let i = 0; i < 6; i++, n++) {
			const [w, h] = shapes[i % shapes.length];
			const name = `SAM_${String(n).padStart(4, '0')}`;
			const file = path.join(ROOT, 'nx500', day, `${name}.JPG`);
			await write(file, await makeImage(w, h, n, name));
			await et.write(
				file,
				{
					DateTimeOriginal: `${day.replace(/-/g, ':')} ${String(9 + i).padStart(2, '0')}:${String(5 * i).padStart(2, '0')}:00`,
					Make: 'SAMSUNG',
					Model: 'NX500',
					LensModel: 'Samsung NX 30mm F2 Pancake',
					FocalLength: 30,
					FNumber: [2, 2.8, 4, 5.6][i % 4],
					ExposureTime: ['1/250', '1/125', '1/60', '1/500'][i % 4],
					ISO: [100, 200, 400, 800][i % 4],
					...(i === 2
						? {
								GPSLatitude: 37.5665,
								GPSLatitudeRef: 'N',
								GPSLongitude: 126.978,
								GPSLongitudeRef: 'E'
							}
						: {})
				},
				['-overwrite_original']
			);
			made.push(file);
		}
	}
	// F31fd: EXIF 있는 작은 JPG 몇 장
	for (let i = 0; i < 3; i++) {
		const name = `DSCF${String(100 + i)}`;
		const file = path.join(ROOT, 'f31fd', `${name}.JPG`);
		await write(file, await makeImage(1280, 960, i + 7, name));
		await et.write(
			file,
			{
				DateTimeOriginal: `2008:08:${String(10 + i).padStart(2, '0')} 15:2${i}:00`,
				Make: 'FUJIFILM',
				Model: 'FinePix F31fd',
				FNumber: 2.8,
				ExposureTime: '1/90',
				ISO: 400,
				FocalLength: 8
			},
			['-overwrite_original']
		);
		made.push(file);
	}
}

async function film() {
	const roll = '2509_01 Rollei 35S - Kodak ColorPlus 200';
	for (let i = 1; i <= 6; i++) {
		const [w, h] = shapes[(i + 2) % shapes.length];
		const name = `2509_01_${String(i).padStart(3, '0')}`;
		const buf = await sharp(await makeImage(w, h, i + 3, name))
			.toColourspace('rgb16')
			.tiff({ compression: 'lzw' })
			.toBuffer();
		const file = path.join(ROOT, 'film', roll, `${name}.tif`);
		await write(file, buf); // EXIF 없음: 스캔 파일 흉내
		made.push(file);
	}
}

async function edits() {
	// A컷: 원본 stem 유지 + 라벨 변형 + LR 접미사
	const a = [
		['SAM_0001', 'nx500/2025-03-12/SAM_0001.JPG', 0],
		['SAM_0003', 'nx500/2025-03-12/SAM_0003.JPG', 1],
		['SAM_0005_cyberpunk', 'nx500/2025-03-12/SAM_0005.JPG', 2],
		['SAM_0008-Edit', 'nx500/2025-05-02/SAM_0008.JPG', 3],
		['2509_01_002', 'film/2509_01 Rollei 35S - Kodak ColorPlus 200/2509_01_002.tif', 4]
	] as const;
	const b = [
		['SAM_0002', 'nx500/2025-03-12/SAM_0002.JPG', 5],
		['2509_01_004', 'film/2509_01 Rollei 35S - Kodak ColorPlus 200/2509_01_004.tif', 0]
	] as const;
	for (const [tier, list] of [
		['A', a],
		['B', b]
	] as const) {
		for (const [stem, srcRel, pi] of list) {
			const src = path.join(ROOT, srcRel);
			const meta = await sharp(src).metadata();
			const w = meta.width ?? 1800;
			const h = meta.height ?? 1200;
			// 보정: 살짝 크롭 + 톤 변화 + 리사이즈 (export 흉내)
			const buf = await sharp(src)
				.extract({
					left: Math.round(w * 0.05),
					top: Math.round(h * 0.05),
					width: Math.round(w * 0.9),
					height: Math.round(h * 0.9)
				})
				.modulate({ brightness: 1.05, saturation: pi % 2 ? 1.3 : 0.8 })
				.resize({ width: 1600, height: 1600, fit: 'inside' })
				.jpeg({ quality: 88 })
				.toBuffer();
			const file = path.join(ROOT, 'edited', tier, `${stem}.jpg`);
			await write(file, buf);
			// export 는 보통 촬영시각/카메라 EXIF 를 유지한다
			const tags = await et.read(src);
			const dto = tags.DateTimeOriginal;
			await et.write(
				file,
				{
					...(dto ? { DateTimeOriginal: typeof dto === 'string' ? dto : dto.toString() } : {}),
					...(tags.Make ? { Make: tags.Make, Model: tags.Model } : {})
				},
				['-overwrite_original']
			);
			made.push(file);
		}
	}
}

await digital();
await film();
await edits();
await et.end();
console.log(`made ${made.length} files under ${ROOT}`);
