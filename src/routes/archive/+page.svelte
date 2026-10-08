<script lang="ts">
	import Pager from '#lib/components/Pager.svelte';
	import PhotoGrid from '#lib/components/PhotoGrid.svelte';
	import type { PageProps } from './$types';
	let { data }: PageProps = $props();
	const ctx = $derived(data.includeB ? 'archive:b' : 'archive');
	const base = $derived(data.includeB ? '/archive?b=1' : '/archive');
</script>

<section class="page">
	<header class="head">
		<h1>아카이브</h1>
		<p class="mono dim">
			{data.total}장
			{#if data.canToggleB}
				· {#if data.includeB}<a href="/archive">B컷 빼기</a>{:else}<a href="/archive?b=1"
						>B컷 포함</a
					>{/if}
			{/if}
		</p>
	</header>
	{#if data.noDb}
		<p class="mono dim">DATABASE_URL 이 없습니다.</p>
	{:else if data.groups.length === 0}
		<p class="mono dim">아직 공개된 사진이 없습니다.</p>
	{/if}
	{#each data.groups as g (g.key)}
		<h2>{g.label}</h2>
		<PhotoGrid items={g.items} {ctx} />
	{/each}
	<Pager page={data.page} hasMore={data.hasMore} {base} />
</section>

<style>
	.page {
		padding: 8px 40px 60px;
	}
	.head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 20px;
		margin: 12px 0 28px;
	}
	h1 {
		font-family: var(--font-serif);
		font-weight: 400;
		font-size: clamp(40px, 6vw, 84px);
		line-height: 1;
		margin: 0;
	}
	h2 {
		font-family: var(--font-serif);
		font-weight: 400;
		font-size: 26px;
		color: var(--color-ink-soft);
		margin: 44px 0 14px;
	}
	.head p {
		font-size: 14px;
		letter-spacing: 0.06em;
	}
	.head a:hover {
		color: var(--color-amber);
	}
	@media (max-width: 720px) {
		.page {
			padding: 8px 16px 40px;
		}
	}
</style>
