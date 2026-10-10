<script lang="ts">
	import PhotoGrid from '#lib/components/PhotoGrid.svelte';
	import type { PageProps } from './$types';
	let { data }: PageProps = $props();
	const EXAMPLES = [
		'비 오는 밤 골목',
		'역광 인물',
		'바다와 배',
		'눈 쌓인 산',
		'붉은 노을',
		'고양이'
	];
</script>

<section class="page">
	<header class="head">
		<h1>검색</h1>
		{#if data.stats && data.stats.total > 0}
			<p class="mono dim">{data.stats.done} / {data.stats.total}장 준비됨</p>
		{/if}
	</header>
	<form class="q" method="GET" action="/search">
		<input
			type="search"
			name="q"
			value={data.q}
			placeholder="말로 찾기 — 예: 비 오는 밤 골목"
			autocomplete="off"
		/>
		<button class="btn" type="submit">찾기</button>
	</form>
	{#if !data.q}
		<p class="mono dim examples">
			{#each EXAMPLES as ex (ex)}<a href={`/search?q=${encodeURIComponent(ex)}`}>{ex}</a>{/each}
		</p>
	{:else if data.error}
		<p class="notice error">{data.error}</p>
	{:else if data.items.length === 0}
		<p class="mono dim">
			맞는 사진이 없습니다.{#if data.stats && data.stats.done === 0}
				아직 임베딩된 사진이 없습니다 — 관리자 설정에서 ML 서버 연결과 임베딩 상태를 확인하세요.{/if}
		</p>
	{:else}
		<PhotoGrid items={data.items} ctx="archive" />
	{/if}
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
		margin: 12px 0 24px;
	}
	h1 {
		font-family: var(--font-serif);
		font-weight: 400;
		font-size: clamp(40px, 6vw, 84px);
		line-height: 1;
		margin: 0;
	}
	.q {
		display: flex;
		gap: 10px;
		max-width: 760px;
		margin: 0 0 28px;
	}
	.q input {
		flex: 1;
		min-width: 0;
		height: 56px;
		padding: 0 16px;
		font: inherit;
		font-size: 20px;
		background: #141311;
		border: 1px solid var(--color-ink-faint);
		color: var(--color-ink);
		border-radius: 2px;
	}
	.q input:focus {
		outline: 1px solid var(--color-amber);
		border-color: var(--color-amber);
	}
	.examples {
		display: flex;
		flex-wrap: wrap;
		gap: 8px 18px;
		font-size: 16px;
	}
	.examples a:hover {
		color: var(--color-amber);
	}
	@media (max-width: 720px) {
		.page {
			padding: 8px 16px 40px;
		}
	}
</style>
