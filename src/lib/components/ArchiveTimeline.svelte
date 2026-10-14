<script lang="ts">
	// 우측 고정 타임라인: 월별 사진 수에 비례한 세로 눈금. 클릭하면 그 달로 이동, 스크롤 중인 달은 호박색.
	// 잡고 위아래로 끌면(마우스·손가락) 달 이름이 따라오고, 이미 불러온 달은 끄는 동안 바로 그 자리로, 놓으면 그 달로.
	// 예전엔 가는 칸을 정확히 눌러야만 해서 터치로는 쓰기 어려웠다.
	import { UNKNOWN_MONTH, monthLabel, type MonthBucket } from '#lib/archive.ts';

	let {
		months,
		active = null,
		onjump,
		onpreview
	}: {
		months: MonthBucket[];
		active?: string | null;
		onjump: (key: string) => void;
		/** 끄는 중: 이미 불러온 달이면 그 자리로 바로 (없으면 아무것도 안 함) */
		onpreview?: (key: string) => void;
	} = $props();

	const total = $derived(months.reduce((n, m) => n + m.count, 0));
	const segs = $derived.by(() => {
		const yearShare = new Map<string, number>();
		for (const m of months) {
			const y = m.key === UNKNOWN_MONTH ? '' : m.key.slice(0, 4);
			yearShare.set(y, (yearShare.get(y) ?? 0) + m.count);
		}
		const seen = new Set<string>();
		let acc = 0;
		return months.map((m) => {
			const year = m.key === UNKNOWN_MONTH ? '' : m.key.slice(0, 4);
			const mid = total ? (acc + m.count / 2) / total : 0;
			acc += m.count;
			const yearStart = !!year && !seen.has(year);
			if (year) seen.add(year);
			// 연도 라벨은 그 해의 비중이 충분할 때만 (겹침 방지)
			const showYear = yearStart && total > 0 && (yearShare.get(year) ?? 0) / total >= 0.04;
			return { ...m, label: monthLabel(m.key), mid, year, yearStart, showYear };
		});
	});

	let hover = $state<string | null>(null);
	let scrub = $state<string | null>(null);
	let track: HTMLDivElement | undefined = $state();
	/** 세로 위치 → 그 높이의 달 (위·아래 밖이면 처음·끝 달) */
	function keyAt(y: number): string | null {
		const btns = track ? [...track.querySelectorAll<HTMLElement>('button.seg')] : [];
		if (btns.length === 0) return null;
		for (const b of btns) if (y < b.getBoundingClientRect().bottom) return b.dataset.key ?? null;
		return btns[btns.length - 1].dataset.key ?? null;
	}
	function down(e: PointerEvent) {
		if (e.button !== 0) return;
		e.preventDefault();
		try {
			track?.setPointerCapture(e.pointerId);
		} catch {
			/* 캡처를 못 해도 막대 위에서는 끌기가 된다 */
		}
		scrub = keyAt(e.clientY);
		if (scrub) onpreview?.(scrub);
	}
	function move(e: PointerEvent) {
		if (e.pointerType === 'mouse' && !scrub) {
			hover = keyAt(e.clientY);
			return;
		}
		if (!scrub) return;
		const k = keyAt(e.clientY);
		if (k && k !== scrub) {
			scrub = k;
			onpreview?.(k);
		}
	}
	function up() {
		const k = scrub;
		scrub = null;
		if (k) onjump(k);
	}
	// 현재 달 라벨은 스크롤로 달이 바뀐 직후 잠깐만 보여준다 (늘 떠 있으면 필터 바·사진을 가린다). 호버 중엔 계속.
	let flash = $state(false);
	$effect(() => {
		if (!active) return;
		flash = true;
		const t = setTimeout(() => (flash = false), 1400);
		return () => clearTimeout(t);
	});
	const shown = $derived(
		scrub
			? (segs.find((s) => s.key === scrub) ?? null)
			: hover
				? (segs.find((s) => s.key === hover) ?? null)
				: flash
					? (segs.find((s) => s.key === active) ?? null)
					: null
	);
</script>

<aside class="timeline" class:scrubbing={!!scrub} aria-label="날짜로 이동">
	<div
		class="track"
		role="presentation"
		bind:this={track}
		onpointerdown={down}
		onpointermove={move}
		onpointerup={up}
		onpointercancel={() => (scrub = null)}
		onpointerleave={() => (hover = null)}
	>
		{#each segs as s (s.key)}
			<!-- 누르기·끌기는 track 이 받는다(위). 버튼은 키보드(Tab·Enter)로 고를 때 -->
			<button
				type="button"
				class="seg"
				data-key={s.key}
				class:active={s.key === (scrub ?? active)}
				class:unknown={s.key === UNKNOWN_MONTH}
				class:year-start={s.yearStart}
				style:flex="{Math.max(s.count, 1)} 1 0px"
				aria-label={`${s.label} · ${s.count}장`}
				onclick={(e) => {
					if (e.detail === 0) onjump(s.key);
				}}
			>
				{#if s.showYear}<span class="year mono">{s.year}</span>{/if}
			</button>
		{/each}
		{#if shown}
			<div class="tip mono" style:top="{shown.mid * 100}%">
				{shown.label} <span class="dim">· {shown.count}장</span>
			</div>
		{/if}
	</div>
</aside>

<style>
	.timeline {
		position: fixed;
		right: 10px;
		top: 112px;
		bottom: 28px;
		width: 56px;
		z-index: 5;
	}
	.track {
		position: relative;
		height: 100%;
		display: flex;
		flex-direction: column;
		gap: 1px;
		cursor: pointer;
		/* 손가락으로 끌 때 페이지가 같이 스크롤되지 않게 */
		touch-action: none;
		user-select: none;
	}
	.seg {
		position: relative;
		display: block;
		width: 100%;
		min-height: 3px;
		margin: 0;
		padding: 0;
		border: 0;
		background: transparent;
		cursor: pointer;
	}
	.seg::after {
		content: '';
		position: absolute;
		right: 0;
		top: 0;
		bottom: 0;
		width: 5px;
		background: var(--color-ink-faint);
		transition: background 0.15s ease;
	}
	.seg.unknown::after {
		opacity: 0.5;
	}
	.seg.year-start::before {
		content: '';
		position: absolute;
		right: 0;
		top: -1px;
		width: 14px;
		height: 1px;
		background: var(--color-ink-dim);
	}
	.seg.active::after {
		background: var(--color-amber);
	}
	@media (hover: hover) {
		.seg:hover::after {
			background: var(--color-amber);
		}
	}
	/* 끄는 중엔 막대를 굵게 — 잡고 있다는 표시 */
	.scrubbing .seg::after {
		width: 8px;
	}
	.year {
		position: absolute;
		right: 18px;
		top: 2px;
		font-size: 14px;
		line-height: 1;
		letter-spacing: 0.06em;
		color: var(--color-ink-dim);
		pointer-events: none;
	}
	.tip {
		position: absolute;
		right: 16px;
		transform: translateY(-50%);
		white-space: nowrap;
		font-size: 15px;
		letter-spacing: 0.04em;
		padding: 5px 9px;
		color: var(--color-ink);
		background: rgba(11, 11, 10, 0.92);
		border: 1px solid var(--color-ink-faint);
		pointer-events: none;
	}
	/* 폰: 오른쪽 가장자리에 얇게. 잡는 폭은 28px, 연도 글자는 빼고 끌 때 달 이름만 */
	@media (max-width: 720px) {
		.timeline {
			right: 0;
			top: 96px;
			bottom: 24px;
			width: 28px;
		}
		.seg::after {
			width: 4px;
			right: 4px;
		}
		.seg.year-start::before {
			width: 10px;
			right: 4px;
		}
		.year {
			display: none;
		}
		.tip {
			right: 30px;
		}
	}
</style>
