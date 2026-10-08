<script lang="ts">
	import type { PageProps } from './$types';
	let { data }: PageProps = $props();
	let active: number = $state(-1);
	const years = (a: number | null, b: number | null) =>
		a && b ? (a === b ? `${a}` : `${a}–${b}`) : (a ?? b ?? '');
</script>

<section class="page">
	<h1>컬렉션</h1>
	{#if data.collections.length === 0}
		<p class="mono dim">아직 공개된 컬렉션이 없습니다.</p>
	{/if}
	<div class="list" role="list">
		<ul>
			{#each data.collections as c, i (c.id)}
				<li>
					<a
						href={`/c/${c.slug}`}
						onmouseenter={() => (active = i)}
						onfocus={() => (active = i)}
						class:dim={active >= 0 && active !== i}
					>
						<span class="title">{c.title}</span>
						<span class="meta mono"
							>{years(c.yearFrom, c.yearTo)}{c.yearFrom || c.yearTo
								? ' · '
								: ''}{c.count}장{#if c.visibility === 'hidden'}
								· 숨김{/if}</span
						>
					</a>
				</li>
			{/each}
		</ul>
		<div class="preview" aria-hidden="true">
			{#each data.collections as c, i (c.id)}
				{#if c.cover}
					<img
						src={c.cover.preview}
						alt=""
						class:show={active === i}
						width={c.cover.width}
						height={c.cover.height}
						loading="lazy"
					/>
				{/if}
			{/each}
		</div>
	</div>
</section>

<style>
	.page {
		padding: 8px 40px 80px;
	}
	h1 {
		font-family: var(--font-serif);
		font-weight: 400;
		font-size: clamp(40px, 6vw, 84px);
		line-height: 1;
		margin: 12px 0 40px;
	}
	.list {
		display: grid;
		grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr);
		gap: 40px;
		align-items: start;
	}
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	li a {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 20px;
		padding: 22px 0;
		border-top: 1px solid var(--color-ink-faint);
		transition: opacity 0.25s ease;
	}
	li:last-child a {
		border-bottom: 1px solid var(--color-ink-faint);
	}
	li a.dim {
		opacity: 0.35;
	}
	.title {
		font-family: var(--font-serif);
		font-size: clamp(28px, 3.6vw, 48px);
		line-height: 1.05;
	}
	.meta {
		font-size: 13px;
		letter-spacing: 0.06em;
		color: var(--color-ink-dim);
		white-space: nowrap;
	}
	.preview {
		position: sticky;
		top: 100px;
		height: 60vh;
	}
	.preview img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: contain;
		object-position: top right;
		opacity: 0;
		transition: opacity 0.3s ease;
	}
	.preview img.show {
		opacity: 1;
	}
	@media (max-width: 900px) {
		.page {
			padding: 8px 16px 60px;
		}
		.list {
			grid-template-columns: 1fr;
		}
		.preview {
			display: none;
		}
	}
</style>
