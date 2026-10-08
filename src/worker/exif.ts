// ExifTool 결과를 컬럼으로 정규화. 전체 덤프는 JSON 으로 따로 보관한다.
import type { Tags } from 'exiftool-vendored';

export type NormalizedExif = {
	takenAt: Date | null;
	takenAtSource: 'exif' | 'xmp' | null;
	cameraMake: string | null;
	cameraModel: string | null;
	lens: string | null;
	focalLengthMm: number | null;
	fNumber: number | null;
	exposureTime: string | null;
	iso: number | null;
	gpsLat: number | null;
	gpsLon: number | null;
	orientation: number | null;
	colorProfile: string | null;
	rating: number | null;
	keywords: string[] | null;
	title: string | null;
	caption: string | null;
	width: number | null;
	height: number | null;
};

type DateLike = { toDate?: () => Date; toMillis?: () => number } | string | undefined;

function toDate(v: DateLike): Date | null {
	if (!v) return null;
	if (typeof v === 'string') {
		// "2025:03:12 14:05:01" 형식
		const m = v.match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
		if (m) return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
		const d = new Date(v);
		return isNaN(d.getTime()) ? null : d;
	}
	if (typeof v.toDate === 'function') {
		const d = v.toDate();
		return isNaN(d.getTime()) ? null : d;
	}
	return null;
}

function num(v: unknown): number | null {
	if (typeof v === 'number') return isFinite(v) ? v : null;
	if (typeof v === 'string') {
		const n = parseFloat(v);
		return isFinite(n) ? n : null;
	}
	return null;
}

function str(v: unknown): string | null {
	if (v == null) return null;
	const s = String(v).trim();
	return s ? s : null;
}

function exposure(v: unknown): string | null {
	if (v == null) return null;
	if (typeof v === 'string') return v.trim() || null;
	if (typeof v === 'number') {
		if (v >= 1) return `${Number(v.toFixed(1))}`;
		return `1/${Math.round(1 / v)}`;
	}
	return null;
}

function colorProfile(t: Record<string, unknown>): string | null {
	const desc = str(t.ProfileDescription);
	if (desc) return desc;
	const cs = t.ColorSpace;
	if (cs === 1 || cs === 'sRGB') return 'sRGB';
	if (cs === 2 || cs === 'Adobe RGB') return 'Adobe RGB';
	if (cs === 65535 || cs === 'Uncalibrated') return 'Uncalibrated';
	return str(cs);
}

export function normalizeExif(tags: Tags): NormalizedExif {
	const t = tags as unknown as Record<string, unknown>;
	let takenAt: Date | null = null;
	let takenAtSource: NormalizedExif['takenAtSource'] = null;
	for (const [key, src] of [
		['SubSecDateTimeOriginal', 'exif'],
		['DateTimeOriginal', 'exif'],
		['CreateDate', 'exif'],
		['DateCreated', 'xmp'],
		['DateTimeCreated', 'xmp']
	] as const) {
		const d = toDate(t[key] as DateLike);
		if (d) {
			takenAt = d;
			takenAtSource = src;
			break;
		}
	}
	const keywordsRaw = t.Keywords ?? t.Subject;
	const keywords = Array.isArray(keywordsRaw)
		? keywordsRaw.map(String)
		: keywordsRaw
			? [String(keywordsRaw)]
			: null;
	const orientation = typeof t.Orientation === 'number' ? t.Orientation : num(t.Orientation);
	let width = num(t.ImageWidth);
	let height = num(t.ImageHeight);
	if (orientation && orientation >= 5 && width && height) [width, height] = [height, width];
	return {
		takenAt,
		takenAtSource,
		cameraMake: str(t.Make),
		cameraModel: str(t.Model),
		lens: str(t.LensModel) ?? str(t.LensID) ?? str(t.Lens),
		focalLengthMm: num(t.FocalLength),
		fNumber: num(t.FNumber),
		exposureTime: exposure(t.ExposureTime),
		iso: num(t.ISO),
		gpsLat: num(t.GPSLatitude),
		gpsLon: num(t.GPSLongitude),
		orientation,
		colorProfile: colorProfile(t),
		rating: num(t.Rating),
		keywords,
		title: str(t.Title) ?? str(t.ObjectName),
		caption: str(t.Description) ?? str(t.ImageDescription) ?? str(t['Caption-Abstract']),
		width,
		height
	};
}

const SKIP_KEYS =
	/^(SourceFile|Directory|FileName|FilePermissions|Preview|Thumbnail|JpgFromRaw|OtherImage|errors|warnings)/;

/** 전체 덤프를 JSON 으로. 바이너리·날짜 객체는 문자열로. */
export function metadataJson(tags: Tags): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	for (const [k, v] of Object.entries(tags as unknown as Record<string, unknown>)) {
		if (SKIP_KEYS.test(k) || v == null) continue;
		if (
			typeof v === 'object' &&
			v !== null &&
			'toISOString' in v &&
			typeof (v as { toISOString: unknown }).toISOString === 'function'
		) {
			out[k] = (v as { toISOString: () => string | undefined }).toISOString() ?? String(v);
		} else if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
			if (typeof v === 'string' && v.length > 2000) continue;
			out[k] = v;
		} else if (Array.isArray(v)) {
			out[k] = v.map((x) => (typeof x === 'object' ? String(x) : x));
		}
	}
	return out;
}
