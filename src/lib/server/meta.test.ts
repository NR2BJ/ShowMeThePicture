import { describe, expect, it } from 'vitest';
import type { RollInfo } from './folders';
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
