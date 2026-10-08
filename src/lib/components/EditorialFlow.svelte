<script lang="ts">
	// 컬렉션 페이지의 "편집 흐름": 한 장 크게 / 두 장 나란히 / 세 장 작게를 번갈아 배치. 종횡비에 따라 세로 사진은 가운데 좁게.
	import { thumbHashToDataURL } from 'thumbhash';
	import { fadeIn } from '#lib/actions/fadeIn.ts';
	import type { GalleryItem } from '#lib/server/gallery.ts';

	let { items, ctx }: { items: GalleryItem[]; ctx: string } = $props();

	const RHYTHM = [1, 2, 1, 3, 2];
	const rows = $derived.by(() => {
		const out: GalleryItem[][] = [];
		let i = 0;
		let r = 0;
		while (i < items.length) {
			let n = RHYTHM[r++ % RHYTHM.length];
			// 세로 사진은 혼자 두지 않고 둘씩 (너무 길어지지 않게)
			if (
				n === 1 &&
				items[i].height > items[i].width &&
				items[i + 1] &&
				items[i + 1].height > items[i + 1].width
			)
				n = 2;
			out.push(items.slice(i, i + n));
			i += n;
		}
		return out;
	});
	function ph(th: string | null) {
		if (!th) return undefined;
		try {
			return `url(${thumbHashToDataURL(Uint8Array.from(atob(th), (c) => c.charCodeAt(0)))})`;
		} catch {
			return undefined;
		}
	}
</script>

<div class="flow">
	{#each rows as row, ri (ri)}
		<div
			class="row"
			class:one={row.length === 1}
			class:two={row.length === 2}
			class:three={row.length === 3}
		>
			{#each row as it (it.id)}
				<a
					class="cell"
					class:portrait={it.height > it.width}
					href={`/p/${it.id}?ctx=${encodeURIComponent(ctx)}`}
					style:aspect-ratio={`${it.width} / ${it.height}`}
					style:background-image={ph(it.thumbhash)}
				>
					<img
						src={row.length === 3 ? it.thumb : it.preview}
						alt=""
						width={it.width}
						height={it.height}
						loading="lazy"
						decoding="async"
						use:fadeIn
					/>
				</a>
			{/each}
		</div>
	{/each}
</div>

<style>
	.flow {
		display: flex;
		flex-direction: column;
		gap: clamp(28px, 5vw, 72px);
	}
	.row {
		display: grid;
		gap: clamp(14px, 2.5vw, 36px);
		align-items: start;
	}
	.row.one {
		grid-template-columns: 1fr;
		justify-items: center;
	}
	.row.two {
		grid-template-columns: 1fr 1fr;
	}
	.row.three {
		grid-template-columns: 1fr 1fr 1fr;
	}
	.cell {
		display: block;
		width: 100%;
		background-size: cover;
		background-position: center;
		background-color: #141311;
	}
	.row.one .cell {
		max-height: 86vh;
		width: auto;
		max-width: 100%;
		height: min(86vh, 100%);
	}
	.row.one .cell.portrait {
		max-width: min(100%, 60vh);
	}
	.cell img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
		opacity: 0;
		transition: opacity 0.6s ease;
	}
	.cell img:global(.loaded) {
		opacity: 1;
	}
	@media (max-width: 720px) {
		.row.two,
		.row.three {
			grid-template-columns: 1fr;
		}
		.row.one .cell.portrait {
			max-width: 100%;
		}
	}
</style>
