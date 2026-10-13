// 관리자 표를 폰에서 카드처럼 쌓을 때 쓰는 칸 이름표. 머리글(th) 글자를 같은 열의 td 에 data-label 로 붙인다.
// CSS(.table.stack, app.css)가 좁은 화면에서 그 이름을 칸 앞에 보여 준다. 행이 바뀌면 다시 붙인다.
export function stackTable(table: HTMLTableElement) {
	const apply = () => {
		const heads = [...table.querySelectorAll('thead th')].map((th) => th.textContent?.trim() ?? '');
		for (const tr of table.querySelectorAll('tbody tr')) {
			let col = 0;
			for (const td of tr.children) {
				if (!(td instanceof HTMLTableCellElement)) continue;
				const span = td.colSpan || 1;
				const label = span === 1 ? heads[col] : '';
				if (label) td.dataset.label = label;
				else delete td.dataset.label;
				col += span;
			}
		}
	};
	apply();
	const mo = new MutationObserver(apply);
	mo.observe(table, { childList: true, subtree: true });
	return { destroy: () => mo.disconnect() };
}
