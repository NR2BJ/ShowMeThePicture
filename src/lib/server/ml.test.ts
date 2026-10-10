import { describe, expect, it } from 'vitest';
import { parseClip, vectorLiteral } from './ml';

describe('ml client', () => {
	it('accepts the embedding as a JSON string or as an array', () => {
		expect(parseClip('[0.1, -0.2, 3]')).toEqual([0.1, -0.2, 3]);
		expect(parseClip([1, 2])).toEqual([1, 2]);
		expect(() => parseClip('nope')).toThrow();
		expect(() => parseClip([])).toThrow();
		expect(() => parseClip(undefined)).toThrow();
	});
	it('formats a pgvector literal', () => {
		expect(vectorLiteral([0.5, 1])).toBe('[0.5,1]');
	});
});
