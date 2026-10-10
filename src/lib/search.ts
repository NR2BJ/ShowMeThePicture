// 검색 모델 목록 (설정 드롭다운). Immich ML 모델 zoo 의 이름 그대로. 서버 전용 코드 금지.
// 숫자는 Immich 문서의 벤치(한국어 질의 recall %, CPU f32 기준 상주 메모리) — 가속기에서는 메모리가 다르다.
export const DEFAULT_SEARCH_MODEL = 'ViT-B-16-SigLIP2__webli';
export const SEARCH_MODELS: { id: string; label: string; note: string }[] = [
	{
		id: 'ViT-B-16-SigLIP2__webli',
		label: 'SigLIP2 B/16',
		note: '한국어 71 · 3.0GB · 가벼움 · 기본'
	},
	{ id: 'ViT-L-16-SigLIP2-256__webli', label: 'SigLIP2 L/16', note: '한국어 75 · 2.8GB · 중간' },
	{
		id: 'ViT-SO400M-16-SigLIP2-384__webli',
		label: 'SigLIP2 SO400M 384',
		note: '한국어 77 · 3.9GB · A380 OpenVINO 에서 사진 모델 실행 실패(2026-10 확인)'
	},
	{
		id: 'nllb-clip-base-siglip__v1',
		label: 'NLLB-CLIP base',
		note: '한국어 77 · 4.7GB · 번역 모델 텍스트 인코더 · 언어 코드 필요 · A380 에서 올라옴'
	},
	{
		id: 'nllb-clip-large-siglip__v1',
		label: 'NLLB-CLIP large',
		note: '한국어 81 · 4.2GB+ · A380 OpenVINO 에서 사진 모델 실행 실패(2026-10 확인) · 언어 코드 필요'
	},
	{
		id: 'XLM-Roberta-Large-ViT-H-14__frozen_laion5b_s13b_b90k',
		label: 'XLM-R CLIP H/14',
		note: '한국어 74 · 4.0GB · 구세대 다국어'
	},
	{
		id: 'ViT-B-16-SigLIP-i18n-256__webli',
		label: 'SigLIP(1) i18n B/16',
		note: '한국어 69 · 3.0GB · SigLIP2 에 밀림'
	}
];
export const needsLanguage = (model: string) => model.startsWith('nllb');
