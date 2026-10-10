import { describe, expect, it } from 'vitest';
import { detectNllbLang, parseClip, vectorLiteral } from './ml';

describe('ml client', () => {
	it('accepts the embedding as a JSON string or as an array', () => {
		expect(parseClip('[0.1, -0.2, 3]')).toEqual([0.1, -0.2, 3]);
		expect(parseClip([1, 2])).toEqual([1, 2]);
		expect(() => parseClip('nope')).toThrow();
		expect(() => parseClip([])).toThrow();
		expect(() => parseClip(undefined)).toThrow();
	});
	it('guesses the NLLB language from the script of the query', () => {
		expect(detectNllbLang('비 오는 밤 골목')).toBe('kor_Hang');
		expect(detectNllbLang('rainy night alley')).toBe('eng_Latn');
		expect(detectNllbLang('雨の夜')).toBe('jpn_Jpan');
		expect(detectNllbLang('夜雨')).toBeNull(); // 한자만: 한·일·중 구분 불가 → 설정값
		expect(detectNllbLang('123')).toBeNull();
		expect(detectNllbLang('café')).toBeNull();
	});
	it('formats a pgvector literal', () => {
		expect(vectorLiteral([0.5, 1])).toBe('[0.5,1]');
	});
});
