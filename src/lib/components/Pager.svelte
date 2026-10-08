<script lang="ts">
	let { page, hasMore, base }: { page: number; hasMore: boolean; base: string } = $props();
	const sep = $derived(base.includes('?') ? '&' : '?');
</script>

{#if page > 1 || hasMore}
	<nav class="pager mono" aria-label="페이지">
		{#if page > 1}<a href={`${base}${sep}page=${page - 1}`}>← 최근</a>{:else}<span></span>{/if}
		<span class="dim">{page}</span>
		{#if hasMore}<a href={`${base}${sep}page=${page + 1}`}>이전 →</a>{:else}<span></span>{/if}
	</nav>
{/if}

<style>
	.pager {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		padding: 40px 0 20px;
		font-size: 12px;
		letter-spacing: 0.08em;
	}
	a:hover {
		color: var(--color-amber);
	}
</style>
