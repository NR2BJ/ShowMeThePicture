// 아주 작은 마크다운 → HTML (소개 페이지, 컬렉션 설명). 서버·클라이언트 공용, 의존성 없음.
// 지원: # ~ ### 제목, 빈 줄로 나눈 문단(줄바꿈은 <br>), - 또는 * 목록, **굵게**, *기울임*, [글](주소), 자동 링크 없음.
// 입력의 HTML 은 전부 이스케이프하고 링크는 http(s)·mailto·사이트 안 경로만 허용한다.

const esc = (s: string) =>
	s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function safeHref(url: string): string | null {
	const u = url.trim();
	if (/^(https?:|mailto:)/i.test(u) || u.startsWith('/') || u.startsWith('#')) return u;
	return null;
}

function inline(src: string): string {
	let s = esc(src);
	s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, text: string, url: string) => {
		const href = safeHref(url.replace(/&amp;/g, '&'));
		if (!href) return text;
		const ext = /^https?:/i.test(href);
		return `<a href="${esc(href)}"${ext ? ' rel="noopener" target="_blank"' : ''}>${text}</a>`;
	});
	s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
	s = s.replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
	return s;
}

export function renderMarkdown(md: string | null | undefined): string {
	if (!md) return '';
	const blocks = md
		.replace(/\r\n?/g, '\n')
		.trim()
		.split(/\n{2,}/);
	const out: string[] = [];
	for (const b of blocks) {
		const lines = b.split('\n');
		const h = lines.length === 1 ? /^(#{1,3})\s+(.+)$/.exec(lines[0]) : null;
		if (h) {
			const n = h[1].length + 1; // # → h2 (페이지 제목이 h1)
			out.push(`<h${n}>${inline(h[2])}</h${n}>`);
		} else if (lines.every((l) => /^\s*[-*]\s+/.test(l))) {
			out.push(
				`<ul>${lines.map((l) => `<li>${inline(l.replace(/^\s*[-*]\s+/, ''))}</li>`).join('')}</ul>`
			);
		} else {
			out.push(`<p>${lines.map(inline).join('<br>')}</p>`);
		}
	}
	return out.join('\n');
}

/** 미리보기 설명용: 마크다운 기호를 걷어 낸 첫 문단 (최대 n자) */
export function plainSummary(md: string | null | undefined, n = 160): string {
	if (!md) return '';
	const first =
		md
			.replace(/\r\n?/g, '\n')
			.trim()
			.split(/\n{2,}/)
			.find((b) => !/^#{1,3}\s/.test(b)) ?? '';
	const t = first
		.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
		.replace(/[*#>`_-]+/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
	return t.length > n ? t.slice(0, n - 1) + '…' : t;
}
