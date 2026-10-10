// 장비·롤의 포맷 프리셋. 매번 손으로 치지 않도록 고르게 하고, 없는 건 '기타'로 직접 쓴다. 값은 그냥 문자열로 저장.
export const DIGITAL_FORMATS = ['1"', 'M4/3', 'APS-C', 'FF'] as const;
export const FILM_FORMATS_135 = ['135 하프', '135 풀'] as const;
export const FILM_FORMATS_120 = ['645', '6x6', '6x7', '6x8', '6x9', '6x17'] as const;
export const FILM_FORMATS_SHEET = ['4x5', '8x10'] as const;
export const FILM_FORMATS = [
	...FILM_FORMATS_135,
	...FILM_FORMATS_120,
	...FILM_FORMATS_SHEET
] as const;
export const ALL_FORMATS: readonly string[] = [...DIGITAL_FORMATS, ...FILM_FORMATS];
