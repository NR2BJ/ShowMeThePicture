// 첫 관리자 생성 보호. 관리자가 0명인 동안 프로세스 메모리에 토큰을 하나 만들어 로그에 찍고,
// /admin/setup 은 그 토큰을 요구한다. 배포 직후 누구나 관리자를 만들 수 있는 창을 막기 위함.
import { randomBytes, timingSafeEqual } from 'node:crypto';

let token: string | null = null;

export function ensureSetupToken(): string {
	if (!token) {
		token = randomBytes(6).toString('hex');
		console.log(
			`\n[setup] 관리자 계정이 없습니다. /admin/setup 에서 이 토큰을 입력하세요: ${token}\n`
		);
	}
	return token;
}

export function verifySetupToken(input: string): boolean {
	if (!token) return false;
	const a = Buffer.from(input.trim());
	const b = Buffer.from(token);
	return a.length === b.length && timingSafeEqual(a, b);
}

export function clearSetupToken(): void {
	token = null;
}
