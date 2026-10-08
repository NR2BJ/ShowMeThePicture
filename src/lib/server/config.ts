// SvelteKit 서버 코드용 설정. 값은 src/env.ts 의 정의를 거쳐 기동 시 검증된다.
import * as env from '$app/env/private';
import type { Config } from './env';

export const config: Config = env;
