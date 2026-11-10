import { describe, expect, it } from 'vitest';
import { rollDay, type RollInfo } from './folders';
import { effectiveMeta } from './gallery';

const scan = { camera: 'NX500', lens: 'Sigma 20-40mm F2.8 EX DG ASPHERICAL' };
const roll: RollInfo = {
	relDir: '26.11_02 Pentax LX',
	title: null,
	developedAt: null,
	rollNo: null,
	camera: 'Pentax LX',
	lens: null,
	filmStock: 'Kodak UltraMax 400',
	filmFormat: null,
	scanner: null,
	notes: null
};

describe('effectiveMeta', () => {
	it('film ignores the scan EXIF (scanner camera/lens are not the shooting gear)', () => {
		const m = effectiveMeta('film', null, scan, roll);
		expect(m.camera).toBe('Pentax LX');
		expect(m.lens).toBeNull();
		expect(effectiveMeta('film', null, scan, null).camera).toBeNull();
	});
	it('digital keeps EXIF first, roll as fallback', () => {
		expect(effectiveMeta('digital', null, scan, roll).lens).toBe(scan.lens);
		expect(effectiveMeta('digital', null, { camera: null, lens: null }, roll).camera).toBe(
			'Pentax LX'
		);
	});
	it('manual override wins', () => {
		expect(effectiveMeta('film', { lens: 'SMC Pentax-M 50mm F1.7' }, scan, roll).lens).toBe(
			'SMC Pentax-M 50mm F1.7'
		);
	});
});

describe('rollDay', () => {
	it('uses the earliest scan day when it falls in the developed month', () => {
		expect(rollDay('2026-11-01', ['2026-11-12', '2026-11-10'])).toBe('2026-11-10');
	});
	it('falls back to the 1st when scanned in another month or unknown', () => {
		expect(rollDay('2026-11-01', ['2026-12-02'])).toBe('2026-11-01');
		expect(rollDay('2026-11-01', [])).toBe('2026-11-01');
	});
});
