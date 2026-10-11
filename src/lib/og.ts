// 페이지 load 가 돌려주는 링크 미리보기 정보. 루트 레이아웃이 이걸로 <title>·og 태그를 낸다. 서버 전용 코드 금지.
export type OgMeta = {
	/** 페이지 제목 (사이트 제목은 레이아웃이 뒤에 붙인다) */
	title?: string;
	description?: string;
	/** 사이트 안 경로 또는 절대 주소 (예: /og/<photoId>.jpg) */
	image?: string | null;
	type?: 'website' | 'article';
};
