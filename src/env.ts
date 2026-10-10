// SvelteKit 3 환경변수 정의. 서버 코드는 `$app/env/private` 에서 타입이 붙은 값을 import 한다.
// 검증 규칙은 src/lib/server/env.ts(zod) 하나뿐이고, worker/스크립트도 같은 규칙으로 process.env 를 읽는다.
import { defineEnvVars } from '@sveltejs/kit/env';
import { EnvSchema } from '#lib/server/env.ts';

const S = EnvSchema.shape;

export const variables = defineEnvVars({
	DATABASE_URL: {
		schema: (v) => S.DATABASE_URL.parse(v),
		description: 'Postgres 접속 문자열. 없으면 랜딩이 빈 상태로 뜬다(로컬 개발).'
	},
	PHOTOS_ROOT: {
		schema: (v) => S.PHOTOS_ROOT.parse(v),
		description: '원본 사진 루트(컨테이너 안 경로). read-only 로만 쓴다.'
	},
	CACHE_DIR: {
		schema: (v) => S.CACHE_DIR.parse(v),
		description: '파생 이미지 캐시(SSD).'
	},
	ML_URL: {
		schema: (v) => S.ML_URL.parse(v),
		description: 'Immich machine-learning 컨테이너 주소.'
	},
	SITE_TITLE: {
		schema: (v) => S.SITE_TITLE.parse(v),
		description: '사이트 제목.'
	},
	SESSION_SECRET: {
		schema: (v) => S.SESSION_SECRET.parse(v),
		description: '관리자 세션 서명 키.'
	},
	GUEST_MAX_EDGE: {
		schema: (v) => S.GUEST_MAX_EDGE.parse(v),
		description: '게스트에게 주는 최대 긴 변(px).'
	},
	SCAN_POLL_MINUTES: {
		schema: (v) => S.SCAN_POLL_MINUTES.parse(v),
		description: 'Source 주기 스캔 기본 간격(분).'
	}
});
