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
	// 설정 언어가 한국어라도 영어로 치면 영어로 보낸다 (NLLB 는 입력 언어를 알아야 제대로 인코딩한다)
	const language = needsLanguage(cfg.model)
		? (detectNllbLang(text) ?? normalizeNllbLang(cfg.language))
		: null;
	const options = language ? { language } : {};
	return predict(cfg, { clip: { textual: { modelName: cfg.model, options } } }, fd, timeoutMs);
}

/** Immich ML 의 NLLB 언어 옵션은 로케일 키(ko, en, ja, zh-CN …)다 — 안에서 FLORES 코드(kor_Hang)로 바꾼다.
 *  예전 설정값이 FLORES 코드면 로케일 키로 되돌린다. */
const FLORES_TO_LOCALE: Record<string, string> = {
	kor_Hang: 'ko',
	eng_Latn: 'en',
	jpn_Jpan: 'ja',
	jpn_Hira: 'ja',
	zho_Hans: 'zh-CN',
	zho_Hant: 'zh-TW'
};
export function normalizeNllbLang(v: string | null | undefined): string {
	const s = (v ?? '').trim();
	if (!s) return 'ko';
	return FLORES_TO_LOCALE[s] ?? s;
}

/** 질의 글자로 언어 추정: 한글 → ko, 가나 → ja, 라틴 글자만 → en.
 *  한자만 있으면 한국 한자·일본 한자·중국어를 가를 수 없어 null(설정값, 기본 ko). */
export function detectNllbLang(text: string): string | null {
	if (/[\u3131-\u318e\uac00-\ud7a3]/.test(text)) return 'ko';
	if (/[\u3040-\u30ff]/.test(text)) return 'ja';
	if (/[A-Za-z]/.test(text) && !/[^\x00-\x7f]/.test(text)) return 'en';
	return null;
}

/** pgvector 리터럴 */
export const vectorLiteral = (v: number[]) => `[${v.join(',')}]`;
