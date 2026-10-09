<script lang="ts">
	import { autoRefresh } from '#lib/actions/autoRefresh.ts';
	import Pager from '#lib/components/Pager.svelte';
	import PhotoGrid from '#lib/components/PhotoGrid.svelte';
	import type { PageProps } from './$types';
	let { data }: PageProps = $props();
	const ctx = $derived(`library:${data.source.slug}`);
</script>

<section class="page" use:autoRefresh={data.source.rootPath ? 8000 : 60000}>
	<header class="head">
		<div>
			<p class="mono dim kicker">
				라이브러리 · {data.source.role === 'edit' ? '보정' : '원본'}{data.source.medium
					? ` · ${data.source.medium === 'film' ? '필름' : '디지털'}`
					: ''}{data.source.tier ? ` · ${data.source.tier}컷` : ''}
			</p>
			<h1>{data.source.name}</h1>
		</div>
		<p class="mono dim">
			{data.total}장{#if !data.source.libraryPublic}
				· 관리자만{/if}
		</p>
	</header>
	{#if data.source.rootPath}<p class="mono dim path">{data.source.rootPath}</p>{/if}
	{#if data.items.length === 0}
		<p class="mono dim">
			아직 처리된 사진이 없습니다. 스캔과 파생본 생성이 끝나면 여기에 나타납니다.
		</p>
	{:else}
		<PhotoGrid items={data.items} {ctx} />
	{/if}
	<Pager page={data.page} hasMore={data.hasMore} base={`/library/${data.source.slug}`} />
</section>

<style>
	.page {
		padding: 8px 40px 60px;
	}
	.head {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 20px;
		margin: 12px 0 10px;
	}
	.kicker {
		font-size: 12px;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		margin: 0 0 8px;
	}
	h1 {
		font-family: var(--font-serif);
		font-weight: 400;
		font-size: clamp(36px, 5vw, 72px);
		line-height: 1;
		margin: 0;
	}
	.path {
		font-size: 12px;
		margin: 0 0 24px;
	}
	@media (max-width: 720px) {
		.page {
			padding: 8px 16px 40px;
		}
	}
</style>
