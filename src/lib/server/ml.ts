// Immich machine-learning 컨테이너 클라이언트. POST /predict (multipart: entries JSON + image | text) → { clip: 임베딩 }.
// 임베딩은 버전에 따라 "[0.1, …]" 문자열로도, 배열로도 온다.
import { needsLanguage } from '#lib/search.ts';

export type MlConfig = { url: string; model: string; language: string | null };

export class MlError extends Error {
	constructor(
		message: string,
		public status?: number
	) {
		super(message);
	}
}

export async function mlPing(url: string, timeoutMs = 3000): Promise<boolean> {
	try {
		const r = await fetch(new URL('ping', url.endsWith('/') ? url : url + '/'), {
			signal: AbortSignal.timeout(timeoutMs)
		});
		return r.ok;
	} catch {
		return false;
	}
}

export function parseClip(v: unknown): number[] {
	const arr = typeof v === 'string' ? (JSON.parse(v) as unknown) : v;
	if (!Array.isArray(arr) || arr.length === 0 || typeof arr[0] !== 'number')
		throw new MlError('ML 응답에 임베딩이 없습니다');
	return arr as number[];
}

async function predict(cfg: MlConfig, entries: unknown, body: FormData, timeoutMs: number) {
	body.append('entries', JSON.stringify(entries));
	let r: Response;
	try {
		r = await fetch(new URL('predict', cfg.url.endsWith('/') ? cfg.url : cfg.url + '/'), {
			method: 'POST',
			body,
			signal: AbortSignal.timeout(timeoutMs)
		});
	} catch (e) {
		throw new MlError(
			`ML 서버에 닿지 못했습니다 (${cfg.url}): ${e instanceof Error ? e.message : e}`
		);
	}
	if (!r.ok) throw new MlError(`ML 응답 ${r.status}: ${(await r.text()).slice(0, 200)}`, r.status);
	const json = (await r.json()) as Record<string, unknown>;
	return parseClip(json.clip);
}

/** 사진 한 장(파생본 webp 바이트) → 벡터. 첫 호출은 모델 로딩 때문에 오래 걸릴 수 있다. */
export async function embedImage(
	cfg: MlConfig,
	bytes: Uint8Array,
	timeoutMs = 180_000
): Promise<number[]> {
	const fd = new FormData();
	fd.append('image', new Blob([bytes.slice().buffer as ArrayBuffer]), 'image.webp');
	return predict(cfg, { clip: { visual: { modelName: cfg.model } } }, fd, timeoutMs);
}

/** 검색 질의 → 벡터. nllb 계열은 언어 코드(kor_Hang)를 같이 보낸다. */
export async function embedText(
	cfg: MlConfig,
	text: string,
	timeoutMs = 60_000
): Promise<number[]> {
	const fd = new FormData();
	fd.append('text', text);
	const options = needsLanguage(cfg.model) && cfg.language ? { language: cfg.language } : {};
	return predict(cfg, { clip: { textual: { modelName: cfg.model, options } } }, fd, timeoutMs);
}

/** pgvector 리터럴 */
export const vectorLiteral = (v: number[]) => `[${v.join(',')}]`;
