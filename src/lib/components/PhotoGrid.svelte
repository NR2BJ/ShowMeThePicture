<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { thumbHashToDataURL } from 'thumbhash';
	import { fadeIn } from '#lib/actions/fadeIn.ts';
	import type { GalleryItem } from '#lib/server/gallery.ts';

	// dup: 검색에서 비슷한 컷을 묶었을 때 대표 뒤에 숨은 장수 (+N 표시)
	type Item = GalleryItem & { dup?: number };
	let {
		items,
		ctx = 'archive',
		targetHeight = 260,
		gap = 12
	}: { items: Item[]; ctx?: string; targetHeight?: number; gap?: number } = $props();

	// 공개·컷 딱지는 관리자에게만 (레이아웃 data.admin). 모든 칸에 둘 다 단다: 왼쪽 공개/숨김, 오른쪽 A/B/X(컷 없음)
	const admin = $derived(!!(page.data as { admin?: unknown }).admin);
	let width = $state(0);
	let root: HTMLDivElement | undefined = $state();
	// bind:clientWidth 는 ResizeObserver 라 한 프레임 늦다. 첫 배치(와 뒤로 가기 스크롤 복원)가 맞도록 마운트 때 바로 잰다.
	onMount(() => {
		if (root) width = root.clientWidth;
	});

	const small = $derived((width || 1200) < 720 || targetHeight < 160);

	type Cell = { it: Item; ar: number };
	const rows = $derived.by(() => {
		const W = width || 1200;
		const th = W < 720 ? 150 : targetHeight;
		const out: { h: number; cells: Cell[] }[] = [];
		let row: Cell[] = [];
		let sum = 0;
		for (const it of items) {
			const ar = it.width && it.height ? it.width / it.height : 1.5;
			row.push({ it, ar });
			sum += ar;
			const h = (W - gap * (row.length - 1)) / sum;
			if (h <= th) {
				out.push({ h, cells: row });
				row = [];
				sum = 0;
			}
		}
		if (row.length) out.push({ h: Math.min(th, (W - gap * (row.length - 1)) / sum), cells: row });
		return out;
	});

	function placeholder(th: string | null): string | undefined {
		if (!th) return undefined;
		try {
			return thumbHashToDataURL(Uint8Array.from(atob(th), (c) => c.charCodeAt(0)));
		} catch {
			return undefined;
		}
	}
</script>

<div class="grid" class:small bind:this={root} bind:clientWidth={width} style:--gap="{gap}px">
	{#each rows as row, r (r)}
		<div class="row" style:height="{row.h}px">
			{#each row.cells as { it, ar } (it.id)}
				<a
					class="cell"
					data-id={it.id}
					href={`/p/${it.id}?ctx=${encodeURIComponent(ctx)}`}
					style:width="{row.h * ar}px"
					style:background-image={placeholder(it.thumbhash)
						? `url(${placeholder(it.thumbhash)})`
						: undefined}
				>
					<img
						src={it.thumb}
						alt=""
						width={it.width}
						height={it.height}
						loading="lazy"
						decoding="async"
						use:fadeIn
					/>
					{#if admin}
						<span class="badge vis" class:off={it.visibility === 'hidden'}
							>{it.visibility === 'hidden' ? '숨김' : '공개'}</span
						>
						<span class="badge cut" class:a={it.tier === 'A'} class:b={it.tier === 'B'}
							>{it.tier ?? 'X'}</span
						>
					{/if}
					{#if it.dup}<span class="badge dup">+{it.dup}</span>{/if}
				</a>
			{/each}
		</div>
	{/each}
</div>

<style>
	.grid {
		display: flex;
		flex-direction: column;
		gap: var(--gap);
	}
	.row {
		display: flex;
		gap: var(--gap);
	}
	.cell {
		position: relative;
		display: block;
		flex: none;
		background-color: #141311;
		background-size: cover;
		background-position: center;
		overflow: hidden;
	}
	.cell img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
		opacity: 0;
		transition: opacity 0.5s ease;
	}
	.cell img:global(.loaded) {
		opacity: 1;
	}
	.cell:hover img {
		opacity: 0.9;
	}
	.badge {
		position: absolute;
		top: 8px;
		left: 8px;
		font-family: var(--font-mono);
		font-size: 14px;
		letter-spacing: 0.1em;
		padding: 3px 7px;
		background: rgba(11, 11, 10, 0.75);
		color: var(--color-ink-dim);
	}
	/* 공개가 기본이라 흐리게, 숨김이 눈에 띄게. (클래스 이름 hidden 은 Tailwind 의 display:none 과 겹쳐 off) */
	.badge.vis {
		color: var(--color-ink-dim);
	}
	.badge.vis.off {
		color: var(--color-ink);
		border-left: 2px solid var(--color-ink);
	}
	.badge.cut {
		left: auto;
		right: 8px;
		min-width: 1.9em;
		text-align: center;
		letter-spacing: 0;
		color: var(--color-ink-dim);
	}
	.badge.cut.a {
		background: var(--color-amber);
		color: var(--color-bg);
	}
	.badge.cut.b {
		color: var(--color-amber);
	}
	/* 작은 격자(비슷한 사진·폰)에서는 딱지를 줄인다 */
	.grid.small .badge {
		top: 4px;
		font-size: 11px;
		padding: 1px 5px;
	}
	.grid.small .badge.vis {
		left: 4px;
	}
	.grid.small .badge.cut {
		right: 4px;
	}
	.badge.dup {
		top: auto;
		bottom: 8px;
		left: auto;
		right: 8px;
		color: var(--color-ink);
	}
</style>
