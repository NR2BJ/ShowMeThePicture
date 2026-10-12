import { describe, expect, it } from 'vitest';
import { dayOf, isBot } from './visits.ts';

describe('isBot', () => {
	it('사람 브라우저는 통과', () => {
		expect(
			isBot(
				'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'
			)
		).toBe(false);
		expect(
			isBot('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36')
		).toBe(false);
	});
	it('봇·미리보기·스크립트·빈 값은 거른다', () => {
		for (const ua of [
			'',
			null,
			'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
			'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)',
			'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
			'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 HeadlessChrome/140 Safari/537.36',
			'python-requests/2.32.3',
			'curl/8.7.1'
		])
			expect(isBot(ua)).toBe(true);
	});
});

describe('dayOf', () => {
	it('일본 시간 기준으로 날이 바뀐다', () => {
		expect(dayOf(new Date('2026-10-11T14:59:59Z'))).toBe('2026-10-11');
		expect(dayOf(new Date('2026-10-11T15:00:00Z'))).toBe('2026-10-12');
	});
});
