import { describe, expect, it } from 'vitest';
import { normalizeStem, parseRollFolder, stemOf } from './stem';

describe('normalizeStem', () => {
	it('keeps camera stems; numeric tails are not labels', () => {
		expect(normalizeStem('SAM_1234', true)).toEqual({ base: 'sam_1234', label: null });
		expect(normalizeStem('DSCF1234', true)).toEqual({ base: 'dscf1234', label: null });
		expect(normalizeStem('2509_01_007', true)).toEqual({ base: '2509_01_007', label: null });
	});
	it('extracts edit labels only for edit sources', () => {
		expect(normalizeStem('SAM_1234_cyberpunk', true)).toEqual({
			base: 'sam_1234',
			label: 'cyberpunk'
		});
		expect(normalizeStem('2509_01_007_bw', true)).toEqual({ base: '2509_01_007', label: 'bw' });
		expect(normalizeStem('SAM_1234_cyberpunk', false)).toEqual({
			base: 'sam_1234_cyberpunk',
			label: null
		});
	});
	it('strips Lightroom/Photoshop suffixes', () => {
		expect(normalizeStem('DSCF1234-Edit', true).base).toBe('dscf1234');
		expect(normalizeStem('SAM_0008-Edit-2', true).base).toBe('sam_0008');
		expect(normalizeStem('SAM_0008 copy', true).base).toBe('sam_0008');
		expect(normalizeStem('SAM_0008-2', true).base).toBe('sam_0008');
		expect(normalizeStem('SAM_0008 (1)', true).base).toBe('sam_0008');
	});
	it('does not strip into nothing', () => {
		expect(normalizeStem('edit', true).base).toBe('edit');
	});
});

describe('stemOf', () => {
	it('drops the last extension only', () => {
		expect(stemOf('SAM_0001.JPG')).toBe('SAM_0001');
		expect(stemOf('2509_01 Rollei.tif')).toBe('2509_01 Rollei');
		expect(stemOf('noext')).toBe('noext');
	});
});

describe('parseRollFolder', () => {
	it('parses the agreed convention', () => {
		expect(parseRollFolder('2509_01 Rollei 35S - Kodak ColorPlus 200')).toEqual({
			developedAt: '2025-09-01',
			rollNo: 1,
			camera: 'Rollei 35S',
			filmStock: 'Kodak ColorPlus 200',
			label: 'Rollei 35S - Kodak ColorPlus 200'
		});
	});
	it('accepts the legacy dotted form without a separator', () => {
		const r = parseRollFolder('25.09_01 Rollei35s kodak colorplus 200');
		expect(r.developedAt).toBe('2025-09-01');
		expect(r.rollNo).toBe(1);
		expect(r.camera).toBeNull();
		expect(r.label).toBe('Rollei35s kodak colorplus 200');
	});
	it('returns label-only for unrecognised names', () => {
		expect(parseRollFolder('여자의변신은무죄')).toMatchObject({
			developedAt: null,
			rollNo: null,
			label: '여자의변신은무죄'
		});
	});
});
