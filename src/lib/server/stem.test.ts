import { describe, expect, it } from 'vitest';
import { gearKeys } from './gear';
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
		expect(parseRollFolder('2509_01 Rollei 35S - Kodak ColorPlus 200')).toMatchObject({
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

describe('parseRollFolder with registered gear', () => {
	const gear = [
		{ kind: 'camera' as const, name: 'Rollei 35S', fixedLens: 'Sonnar 40mm f/2.8' },
		{ kind: 'camera' as const, name: 'Nikon FM2', fixedLens: null },
		{ kind: 'film' as const, name: 'Kodak ColorPlus 200', fixedLens: null },
		{ kind: 'film' as const, name: 'Kodak Gold 200', fixedLens: null },
		{ kind: 'film' as const, name: "LomoChrome Color '92 Sun-kissed 400", fixedLens: null }
	];
	it('finds camera and film without a separator, fills the fixed lens', () => {
		const r = parseRollFolder('25.09_01 Rollei35s kodak colorplus 200', gear);
		expect(r).toMatchObject({
			developedAt: '2025-09-01',
			rollNo: 1,
			camera: 'Rollei 35S',
			lens: 'Sonnar 40mm f/2.8',
			filmStock: 'Kodak ColorPlus 200'
		});
	});
	it('handles a leading dash and mixed order', () => {
		const r = parseRollFolder('2509_02 - gold200 Nikon FM2', gear);
		expect(r).toMatchObject({
			rollNo: 2,
			camera: 'Nikon FM2',
			lens: null,
			filmStock: 'Kodak Gold 200'
		});
	});
	it('falls back to the dash convention when nothing is registered', () => {
		const r = parseRollFolder('2509_03 Leica M6 - Portra 400', gear);
		expect(r).toMatchObject({ camera: 'Leica M6', filmStock: 'Portra 400' });
	});
	it('matches without the brand word, but never a sibling that only shares the brand', () => {
		expect(parseRollFolder('2510_01 Rollei35s colorplus200', gear).filmStock).toBe(
			'Kodak ColorPlus 200'
		);
		expect(parseRollFolder('2510_02 Rollei35s kodak 200', gear).filmStock).toBeNull();
		expect(parseRollFolder('2510_03 Rollei35s Kodak Gold 200', gear).filmStock).toBe(
			'Kodak Gold 200'
		);
		expect(parseRollFolder('2510_04 Rollei35s lomosunkissed400', gear).filmStock).toBe(
			"LomoChrome Color '92 Sun-kissed 400"
		);
	});
});

describe('gearKeys', () => {
	it('full name, brand-less suffixes, prefixes and one long distinctive word', () => {
		expect(gearKeys('Kodak ColorPlus 200')).toEqual(
			expect.arrayContaining(['kodakcolorplus200', 'colorplus200', 'kodakcolorplus', 'colorplus'])
		);
		expect(gearKeys('Kodak Gold 200')).not.toContain('kodak');
		expect(gearKeys('Kodak Gold 200')).not.toContain('200');
		expect(gearKeys('Fuji Speed 400')).not.toContain('speed');
		expect(gearKeys('NX500')).toEqual(['nx500']);
	});
});
