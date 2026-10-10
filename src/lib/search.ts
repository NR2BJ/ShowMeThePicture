// 검색 모델 목록 (설정 드롭다운). Immich ML 모델 zoo 의 이름 그대로. 서버 전용 코드 금지.
export const DEFAULT_SEARCH_MODEL = 'ViT-B-16-SigLIP2__webli';
export const SEARCH_MODELS: { id: string; label: string; note: string }[] = [
	{ id: 'ViT-B-16-SigLIP2__webli', label: 'SigLIP2 B/16', note: '다국어 · 가벼움 · 권장' },
	{ id: 'ViT-L-16-SigLIP2-256__webli', label: 'SigLIP2 L/16 256', note: '다국어 · 중간' },
	{
		id: 'ViT-SO400M-16-SigLIP2-384__webli',
		label: 'SigLIP2 SO400M 384',
		note: '다국어 · 무거움 · 가장 정확'
	},
	{ id: 'ViT-B-16-SigLIP-i18n-256__webli', label: 'SigLIP i18n B/16', note: '다국어 · 가벼움' },
	{
		id: 'nllb-clip-base-siglip__v1',
		label: 'NLLB-CLIP base',
		note: '한국어 텍스트 인코더 · 언어 설정 필요'
	},
	{
		id: 'nllb-clip-large-siglip__v1',
		label: 'NLLB-CLIP large',
		note: '한국어 텍스트 인코더 · 무거움 · 언어 설정 필요'
	},
	{
		id: 'XLM-Roberta-Base-ViT-B-32__laion5b_s13b_b90k',
		label: 'XLM-R CLIP B/32',
		note: '다국어 · 가벼움'
	}
];
export const needsLanguage = (model: string) => model.startsWith('nllb');
