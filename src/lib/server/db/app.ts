// SvelteKit 서버 코드용 DB 핸들. worker 는 자기 config 로 getDb 를 직접 부른다.
import { config } from '../config';
import { getDb, type Db } from './index';

export function db(): Db {
	return getDb(config.DATABASE_URL);
}
