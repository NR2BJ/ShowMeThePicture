import { describe, expect, it } from 'vitest';
import { pickGear, type GearRow } from './gear.ts';

const row = (kind: GearRow['kind'], name: string, fixedLens: string | null = null): GearRow =>
	({ id: name, kind, name, fixedLens, format: null, notes: null, position: 0 }) as GearRow;

describe('pickGear', () => {
	const lenses = [row('lens', 'NX 16-50 PZ'), row('lens', 'NX 16-50 S'), row('lens', 'NX 30mm F2')];
	const pick = (raw: string) => pickGear(raw, 'lens', lenses)?.name ?? null;

	it('이름이 비슷한 두 렌즈를 EXIF 낱말로 가린다', () => {
		expect(pick('Samsung NX 16-50mm F2-2.8 S ED OIS')).toBe('NX 16-50 S');
		expect(pick('Samsung NX 16-50mm F3.5-5.6 Power Zoom ED OIS')).toBe('NX 16-50 PZ');
		expect(pick('NX 16-50mm F3.5-5.6 PZ ED OIS')).toBe('NX 16-50 PZ');
	});
	it('같은 이름은 그대로', () => {
		expect(pick('nx 16-50 s')).toBe('NX 16-50 S');
	});
	it('후보가 하나면 예전처럼', () => {
		expect(pick('Samsung NX 30mm F2 Pancake')).toBe('NX 30mm F2');
	});
	it('맞는 게 없으면 null', () => {
		expect(pick('Samsung NX 45mm F1.8')).toBe(null);
	});
	it('카메라도 그대로 동작', () => {
		const cams = [
			row('camera', 'NX500'),
			row('camera', 'Fujifilm Finepix F31fd', 'Fujinon 8-24mm')
		];
		expect(pickGear('NX500', 'camera', cams)?.name).toBe('NX500');
		expect(pickGear('FinePix F31fd', 'camera', cams)?.name).toBe('Fujifilm Finepix F31fd');
	});
});
