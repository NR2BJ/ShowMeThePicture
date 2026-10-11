import { describe, expect, it } from 'vitest';
import { plainSummary, renderMarkdown } from './markdown';

describe('renderMarkdown', () => {
	it('문단·줄바꿈·제목·목록', () => {
		expect(renderMarkdown('# 안녕\n\n첫 줄\n둘째 줄\n\n- 하나\n- 둘')).toBe(
			'<h2>안녕</h2>\n<p>첫 줄<br>둘째 줄</p>\n<ul><li>하나</li><li>둘</li></ul>'
		);
	});
	it('굵게·기울임·링크', () => {
		expect(renderMarkdown('**굵게** *기울임* [인스타](https://instagram.com/x)')).toBe(
			'<p><strong>굵게</strong> <em>기울임</em> <a href="https://instagram.com/x" rel="noopener" target="_blank">인스타</a></p>'
		);
		expect(renderMarkdown('[아카이브](/archive)')).toBe('<p><a href="/archive">아카이브</a></p>');
	});
	it('HTML 과 위험한 링크는 막는다', () => {
		expect(renderMarkdown('<script>x</script>')).toBe('<p>&lt;script&gt;x&lt;/script&gt;</p>');
		const js = renderMarkdown('[누르기](javascript:alert(1))');
		expect(js).not.toContain('<a');
		expect(js).not.toContain('javascript');
		expect(renderMarkdown('[a](https://x.com/"onmouseover=1)')).not.toContain('"onmouseover');
	});
	it('빈 값', () => {
		expect(renderMarkdown('')).toBe('');
		expect(renderMarkdown(null)).toBe('');
	});
});

describe('plainSummary', () => {
	it('제목은 건너뛰고 첫 문단을 기호 없이', () => {
		expect(plainSummary('# 소개\n\n**필름**과 [디지털](https://a.b)로 찍습니다.\n\n둘째')).toBe(
			'필름 과 디지털로 찍습니다.'
		);
		expect(plainSummary('가'.repeat(200), 10)).toBe('가'.repeat(9) + '…');
	});
});
