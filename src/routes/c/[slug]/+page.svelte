<script lang="ts">
	import EditorialFlow from '#lib/components/EditorialFlow.svelte';
	import type { PageProps } from './$types';
	let { data }: PageProps = $props();
	const ctx = $derived(`c:${data.c.slug}`);
</script>

<svelte:head><title>{data.c.title}</title></svelte:head>

<section class="page">
	<header class="head">
		<p class="mono dim kicker"><a href="/collections">컬렉션</a> · {data.c.count}장</p>
		<h1>{data.c.title}</h1>
		{#if data.c.statementMd}<p class="statement">{data.c.statementMd}</p>{/if}
	</header>
	{#each data.groups as g (g.key)}
		{#if g.title}<h2>{g.title}</h2>{/if}
		<EditorialFlow items={g.items} {ctx} />
	{/each}
	{#if data.c.count === 0}<p class="mono dim">아직 사진이 없습니다.</p>{/if}
</section>

<style>
	.page {
		padding: 8px 40px 100px;
		max-width: 1400px;
		margin: 0 auto;
	}
	.head {
		margin: 12px 0 clamp(36px, 6vw, 80px);
		max-width: 820px;
	}
	.kicker {
		font-size: 15px;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		margin: 0 0 10px;
	}
	.kicker a:hover {
		color: var(--color-amber);
	}
	h1 {
		font-family: var(--font-serif);
		font-weight: 400;
		font-size: clamp(44px, 7vw, 104px);
		line-height: 0.98;
		margin: 0 0 22px;
	}
	.statement {
		font-size: 22px;
		line-height: 1.6;
		color: var(--color-ink-soft);
		margin: 0;
	}
	h2 {
		font-family: var(--font-serif);
		font-weight: 400;
		font-size: 28px;
		color: var(--color-ink-soft);
		margin: clamp(40px, 7vw, 90px) 0 24px;
	}
	@media (max-width: 720px) {
		.page {
			padding: 8px 16px 60px;
		}
	}
</style>
