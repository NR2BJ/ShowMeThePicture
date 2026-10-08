// 파일명 stem 정규화. 페어링 키(stem_norm)와 보정본 라벨(edit_label)을 만든다. 순수 함수 — 테스트 대상.

/** Lightroom/Photoshop 류 접미사: -Edit, -Edit-2, _edit, -2, (1), " copy" */
const SUFFIX_RE =
	/(?:[-_ ]?edit(?:ed)?(?:[-_ ]?\d+)?|[-_ ]copy(?:[-_ ]?\d+)?|[-_ ]\d{1,2}|\s?\(\d+\))$/i;

export function stemOf(filename: string): string {
	const i = filename.lastIndexOf('.');
	return i <= 0 ? filename : filename.slice(0, i);
}

/**
 * `SAM_1234_cyberpunk` → { base: 'SAM_1234', label: 'cyberpunk' }
 * `SAM_1234`           → { base: 'SAM_1234', label: null }   (숫자만인 꼬리는 라벨이 아니다)
 * `2509_01_007_bw`     → { base: '2509_01_007', label: 'bw' }
 * `DSCF1234-Edit`      → { base: 'DSCF1234', label: null }
 */
export function normalizeStem(
	stem: string,
	allowLabel: boolean
): { base: string; label: string | null } {
	let s = stem.normalize('NFC').trim();
	// 접미사 제거는 두 번까지 (예: `-Edit-2` 뒤에 ` copy`)
	for (let i = 0; i < 2; i++) {
		const next = s.replace(SUFFIX_RE, '');
		if (next === s || !/\d/.test(next)) break;
		s = next;
	}
	let label: string | null = null;
	if (allowLabel) {
		const m = s.match(/^(.*\d.*)_([^_]*[\p{L}][^_]*)$/u);
		if (m && !/^(?:edit|copy)$/i.test(m[2])) {
			s = m[1];
			label = m[2];
		}
	}
	return { base: s.toLowerCase(), label };
}

/** 롤 폴더명: `2509_01 Rollei 35S - Kodak ColorPlus 200` / `25.09_01 Rollei35s kodak colorplus 200` */
export function parseRollFolder(name: string): {
	developedAt: string | null; // YYYY-MM-01
	rollNo: number | null;
	camera: string | null;
	filmStock: string | null;
	label: string;
} {
	const m = name.normalize('NFC').match(/^(\d{2})\.?(\d{2})_(\d{1,3})\s*(.*)$/);
	if (!m) return { developedAt: null, rollNo: null, camera: null, filmStock: null, label: name };
	const [, yy, mm, roll, rest] = m;
	const developedAt = `20${yy}-${mm}-01`;
	const rollNo = Number(roll);
	const parts = rest.split(/\s+-\s+/);
	if (parts.length >= 2) {
		return {
			developedAt,
			rollNo,
			camera: parts[0].trim() || null,
			filmStock: parts.slice(1).join(' - ').trim() || null,
			label: rest.trim()
		};
	}
	return { developedAt, rollNo, camera: null, filmStock: null, label: rest.trim() };
}
