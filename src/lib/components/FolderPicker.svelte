<script lang="ts">
	import { onMount } from 'svelte';

	let { value = $bindable('') }: { value?: string } = $props();

	let rel = $state('');
	let dirs: { name: string; rel: string }[] = $state([]);
	let imageCount = $state(0);
	let loading = $state(false);
	let error: string | null = $state(null);

	async function open(p: string) {
		loading = true;
		error = null;
		try {
			const r = await fetch(`/api/admin/fs?path=${encodeURIComponent(p)}`);
			if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
			const d = (await r.json()) as {
				rel: string;
				dirs: { name: string; rel: string }[];
				imageCount: number;
			};
			rel = d.rel;
			dirs = d.dirs;
			imageCount = d.imageCount;
			value = rel;
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			loading = false;
		}
	}
	onMount(() => {
		open(value);
	});

	const crumbs = $derived(rel ? rel.split('/') : []);
</script>

<div class="picker" aria-busy={loading}>
	<div class="crumbs mono">
		<button type="button" onclick={() => open('')}>/photos</button>
		{#each crumbs as c, i (i)}
			<span class="sep">/</span>
			<button type="button" onclick={() => open(crumbs.slice(0, i + 1).join('/'))}>{c}</button>
		{/each}
	</div>
	{#if error}
		<p class="err mono">{error}</p>
	{:else}
		<ul>
			{#each dirs as d (d.rel)}
				<li><button type="button" onclick={() => open(d.rel)}>{d.name}/</button></li>
			{:else}
				<li class="dim mono">하위 폴더 없음</li>
			{/each}
		</ul>
		<p class="mono dim">
			이 폴더의 이미지 {imageCount}장 · 하위 폴더는 등록 후 전부 재귀로 스캔됩니다
		</p>
	{/if}
</div>

<style>
	.picker {
		border: 1px solid var(--color-ink-faint);
		border-radius: 2px;
		background: #141311;
	}
	.crumbs {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		align-items: baseline;
		padding: 10px 12px;
		border-bottom: 1px solid var(--color-ink-faint);
		font-size: 17px;
	}
	.crumbs button,
	li button {
		background: none;
		border: 0;
		color: var(--color-ink);
		font: inherit;
		cursor: pointer;
		padding: 2px 4px;
	}
	.crumbs button:hover,
	li button:hover {
		color: var(--color-amber);
	}
	.sep {
		color: var(--color-ink-faint);
	}
	ul {
		list-style: none;
		margin: 0;
		padding: 6px 8px;
		max-height: 260px;
		overflow: auto;
		columns: 2;
	}
	li {
		break-inside: avoid;
		font-size: 20px;
	}
	.picker > p {
		margin: 0;
		padding: 8px 12px 10px;
		border-top: 1px solid var(--color-ink-faint);
		font-size: 15px;
	}
	.err {
		color: #d98a7a;
	}
</style>
