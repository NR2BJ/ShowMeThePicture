<script lang="ts">
	import { onMount } from 'svelte';
	import { thumbHashToDataURL } from 'thumbhash';
	import { fadeIn } from '#lib/actions/fadeIn.ts';
	import type { GalleryItem } from '#lib/server/gallery.ts';

	let {
		items,
		ctx = 'archive',
		targetHeight = 260,
		gap = 12
	}: { items: GalleryItem[]; ctx?: string; targetHeight?: number; gap?: number } = $props();

	let width = $state(0);
	let root: HTMLDivElement | undefined = $state();
	// bind:clientWidth 는 ResizeObserver 라 한 프레임 늦다. 첫 배치(와 뒤로 가기 스크롤 복원)가 맞도록 마운트 때 바로 잰다.
	onMount(() => {
		if (root) width = root.clientWidth;
	});

	type Cell = { it: GalleryItem; ar: number };
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

<div class="grid" bind:this={root} bind:clientWidth={width} style:--gap="{gap}px">
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
					{#if it.visibility === 'hidden'}<span class="badge">숨김</span>{/if}
					{#if it.tier === 'B'}<span class="badge b">B</span>{/if}
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
		font-size: 11px;
		letter-spacing: 0.1em;
		padding: 3px 7px;
		background: rgba(11, 11, 10, 0.75);
		color: var(--color-ink-dim);
	}
	.badge.b {
		left: auto;
		right: 8px;
		color: var(--color-amber);
	}
</style>
