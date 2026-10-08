// 아주 단순한 인메모리 제한기 (프로세스 하나 기준). 로그인 실패 횟수 제한에 쓴다.
const buckets = new Map<string, { count: number; resetAt: number }>();

export function isLimited(key: string, max: number): boolean {
	const b = buckets.get(key);
	if (!b) return false;
	if (b.resetAt < Date.now()) {
		buckets.delete(key);
		return false;
	}
	return b.count >= max;
}

export function hit(key: string, windowMs: number): void {
	const now = Date.now();
	const b = buckets.get(key);
	if (!b || b.resetAt < now) buckets.set(key, { count: 1, resetAt: now + windowMs });
	else b.count++;
}

export function reset(key: string): void {
	buckets.delete(key);
}
