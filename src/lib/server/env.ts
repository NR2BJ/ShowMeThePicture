// 환경변수 → 설정. SvelteKit 밖(worker, 스크립트)에서도 쓰이므로 $env 를 import 하지 않는다.
import { z } from 'zod';

export const EnvSchema = z.object({
	DATABASE_URL: z.string().min(1).optional(),
	PHOTOS_ROOT: z.string().default('/photos'),
	CACHE_DIR: z.string().default('/cache'),
	ML_URL: z.string().default('http://ml:3003'),
	SITE_TITLE: z.string().default('Show Me The Picture'),
	SESSION_SECRET: z.string().default('dev-secret-change-me'),
	GUEST_MAX_EDGE: z.coerce.number().int().positive().default(2560),
	SCAN_POLL_MINUTES: z.coerce.number().int().positive().default(30)
});

export type Config = z.infer<typeof EnvSchema>;

export function loadConfig(raw: Record<string, string | undefined>): Config {
	return EnvSchema.parse(raw);
}
