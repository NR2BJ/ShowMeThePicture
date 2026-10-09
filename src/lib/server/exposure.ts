// 폴더의 게스트 공개 범위를 한 값으로: 비공개 / 사진만 / 사진 + 폴더 페이지. (default_visibility, library_public) 로 저장한다.
export type Exposure = 'private' | 'photos' | 'all';

export function toExposure(
	defaultVisibility: 'public' | 'hidden',
	libraryPublic: boolean
): Exposure {
	if (defaultVisibility === 'hidden') return 'private';
	return libraryPublic ? 'all' : 'photos';
}

export function fromExposure(e: Exposure): {
	defaultVisibility: 'public' | 'hidden';
	libraryPublic: boolean;
} {
	if (e === 'private') return { defaultVisibility: 'hidden', libraryPublic: false };
	if (e === 'all') return { defaultVisibility: 'public', libraryPublic: true };
	return { defaultVisibility: 'public', libraryPublic: false };
}

export const EXPOSURE_LABEL: Record<Exposure, string> = {
	private: '비공개 — 관리자만',
	photos: '사진만 공개 — 아카이브·랜딩·컬렉션에 보임, 폴더 페이지는 관리자만',
	all: '사진 + 폴더 페이지 공개 — /library/… 도 게스트에게 열림'
};
export const EXPOSURE_SHORT: Record<Exposure, string> = {
	private: '비공개',
	photos: '사진만',
	all: '사진+폴더 페이지'
};

export function parseExposure(v: FormDataEntryValue | null): Exposure {
	return v === 'photos' || v === 'all' ? v : 'private';
}
