<script lang="ts">
	// 우측 고정 타임라인: 월별 사진 수에 비례한 세로 눈금. 클릭하면 그 달로 이동, 스크롤 중인 달은 호박색.
	import { UNKNOWN_MONTH, monthLabel, type MonthBucket } from '#lib/archive.ts';

	let {
		months,
		active = null,
		onjump
	}: { months: MonthBucket[]; active?: string | null; onjump: (key: string) => void } = $props();

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
	// 현재 달 라벨은 스크롤로 달이 바뀐 직후 잠깐만 보여준다 (늘 떠 있으면 필터 바·사진을 가린다). 호버 중엔 계속.
	let flash = $state(false);
	$effect(() => {
		if (!active) return;
		flash = true;
		const t = setTimeout(() => (flash = false), 1400);
		return () => clearTimeout(t);
	});
	const shown = $derived(
		hover
			? (segs.find((s) => s.key === hover) ?? null)
			: flash
				? (segs.find((s) => s.key === active) ?? null)
				: null
	);
</script>

<aside class="timeline" aria-label="날짜로 이동" onpointerleave={() => (hover = null)}>
	<div class="track">
		{#each segs as s (s.key)}
			<button
				type="button"
				class="seg"
				class:active={s.key === active}
				class:unknown={s.key === UNKNOWN_MONTH}
				class:year-start={s.yearStart}
				style:flex="{Math.max(s.count, 1)} 1 0px"
				aria-label={`${s.label} · ${s.count}장`}
				onclick={() => onjump(s.key)}
				onpointerenter={() => (hover = s.key)}
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
	.seg:hover::after,
	.seg.active::after {
		background: var(--color-amber);
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
	@media (max-width: 720px) {
		.timeline {
			display: none;
		}
	}
</style>
