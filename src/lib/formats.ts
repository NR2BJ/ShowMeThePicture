// 장비 포맷 프리셋. 필름은 필름 규격(하프/풀, 645/6x6 같은 프레임은 바디가 정하므로 안 나눈다), 디지털은 센서 크기. 값은 문자열로 저장.
export const DIGITAL_FORMATS = ['1" 이하', '1"', '4/3', 'APS-C', 'APS-H', 'FF', '4433'] as const;
export const FILM_FORMATS = ['110', '135', '120', '220', '4x5', '8x10'] as const;
/** 표시용 설명 (값은 그대로) */
export const FORMAT_LABEL: Record<string, string> = {
	'1" 이하': '1" 이하 (컴팩트 · 폰)',
	'4/3': '4/3 (포서드 · 마포)',
	'4433': '4433 (중형 디지털)'
};
export const ALL_FORMATS: readonly string[] = [...DIGITAL_FORMATS, ...FILM_FORMATS];
