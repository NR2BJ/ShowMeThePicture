import { describe, expect, it } from 'vitest';
import { decide, hamming, scorePair, type PairFile } from './pairing';

const base = (over: Partial<PairFile> = {}): PairFile => ({
	id: 'x',
	stemNorm: 'sam_0001',
	takenAt: new Date('2025-03-12T09:00:00Z'),
	takenAtSource: 'exif',
	cameraModel: 'NX500',
	phash: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]),
	photoId: null,
	relPath: 'a/SAM_0001.JPG',
	...over
});

describe('scorePair', () => {
	it('stem + time + camera + phash → full confidence', () => {
		const s = scorePair(base({ id: 'e' }), base({ id: 'o' }));
		expect(s.total).toBe(1);
		expect(s.method).toBe('stem');
		expect(decide(s.total)).toBe('auto');
	});
	it('stem alone is review, stem + exact time is auto', () => {
		const noTime = scorePair(
			base({ takenAt: null, takenAtSource: null, phash: null, cameraModel: null }),
			base({ phash: null, cameraModel: null })
		);
		expect(noTime.total).toBeCloseTo(0.5);
		expect(decide(noTime.total)).toBe('review');
		const withTime = scorePair(
			base({ phash: null, cameraModel: null }),
			base({ phash: null, cameraModel: null })
		);
		expect(withTime.total).toBeCloseTo(0.9);
		expect(decide(withTime.total)).toBe('auto');
	});
	it('ignores roll/mtime dates for the time signal', () => {
		const s = scorePair(
			base({ takenAtSource: 'roll', phash: null, cameraModel: null }),
			base({ takenAtSource: 'roll', phash: null, cameraModel: null })
		);
		expect(s.time).toBe(0);
	});
	it('phash distance drives the visual signal', () => {
		const o = base({ stemNorm: 'other', cameraModel: null, takenAt: null });
		const near = base({
			stemNorm: 'x',
			cameraModel: null,
			takenAt: null,
			phash: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 9])
		});
		expect(hamming(near.phash!, o.phash!)).toBe(1);
		expect(scorePair(near, o).phash).toBe(0.5);
		const far = base({
			stemNorm: 'x',
			cameraModel: null,
			takenAt: null,
			phash: new Uint8Array([255, 255, 255, 255, 0, 0, 0, 0])
		});
		expect(scorePair(far, o).phash).toBe(0);
		expect(decide(scorePair(far, o).total)).toBe('none');
	});
});
