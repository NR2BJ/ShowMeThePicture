// 파생 이미지 URL. 클라이언트에서도 쓰므로 순수 함수만.
export const SIZES = { thumb: 480, preview: 1600, full: 2560 } as const;
export type SizeName = keyof typeof SIZES;
export const SIZE_NAMES = Object.keys(SIZES) as SizeName[];

/** version 은 content_hash 앞 8자. 파일 내용이 바뀌면 URL 이 바뀌어 캐시가 갈린다. */
export function mediaUrl(fileId: string, size: SizeName, version?: string | null): string {
	return `/media/${fileId}/${size}.webp${version ? `?v=${version}` : ''}`;
}

/** rotation 이 바뀌면 URL 도 바뀌어야 캐시가 갈린다. */
export function versionOf(contentHash: string | null | undefined, rotation = 0): string | null {
	if (!contentHash) return null;
	return contentHash.slice(0, 8) + (rotation % 4 ? `r${rotation % 4}` : '');
}
