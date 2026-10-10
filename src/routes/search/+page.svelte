<script lang="ts">
	import PhotoGrid from '#lib/components/PhotoGrid.svelte';
	import { splitByRelevance } from '#lib/search.ts';
	import type { PageProps } from './$types';
	let { data }: PageProps = $props();
	// 가장 가까운 사진에 한참 못 미치는 결과는 접어 둔다 — 60장을 무조건 다 깔면 뒤쪽은 엉뚱해 보인다
	const split = $derived(splitByRelevance(data.items, data.mean));
	// 관리자용: 1등이 라이브러리 평균에서 표준편차 몇 배 위인지 (노이즈만 있으면 1818장 기준 3.5~4 근처)
	const z = $derived(data.std > 0 ? (split.top - data.mean) / data.std : 0);
	// 관리자가 설정한 기준보다 1등 유사도가 낮으면 '맞는 사진 없음' — 모델이 모르는 말(윤슬 등)에 엉뚱한 사진을 깔지 않게
	const noMatch = $derived(data.floor != null && data.items.length > 0 && split.top < data.floor);
	let showWeak = $state(false);
	let showAnyway = $state(false);
	$effect(() => {
		data.q;
		showWeak = false;
		showAnyway = false;
	});
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
	{:else if noMatch && !showAnyway}
		<p class="mono dim nomatch">
			'{data.q}'에 맞는 사진이 없습니다. 낱말 하나보다 장면을 풀어 쓰면 잘 찾습니다 (예: 윤슬 → 물
			위에 반짝이는 햇빛) ·
			<button type="button" onclick={() => (showAnyway = true)}>그래도 가까운 순으로 보기</button>
			{#if data.admin}
				<span class="dim">
					· 유사도 최고 {split.top.toFixed(3)} / 평균 {data.mean.toFixed(3)} / 기준 {(
						data.floor ?? 0
					).toFixed(3)} · z {z.toFixed(1)}</span
				>
			{/if}
		</p>
	{:else}
		<PhotoGrid items={split.strong} ctx="archive" />
		{#if split.weak.length > 0 || data.collapsed > 0 || data.admin}
			<p class="mono dim more">
				{#if split.weak.length > 0}
					{#if showWeak}
						관련도 낮은 {split.weak.length}장도 보는 중 ·
						<button type="button" onclick={() => (showWeak = false)}>접기</button>
					{:else}
						관련도 낮은 {split.weak.length}장은 접어 두었습니다 ·
						<button type="button" onclick={() => (showWeak = true)}>펼치기</button>
					{/if}
				{/if}
				{#if data.collapsed > 0}
					<span
						>{split.weak.length > 0 ? '· ' : ''}비슷한 컷 {data.collapsed}장은 대표 한 장에 +숫자로
						묶었습니다</span
					>
				{/if}
				{#if data.admin}
					<span class="dim">
						{split.weak.length > 0 || data.collapsed > 0 ? '· ' : ''}유사도 최고 {split.top.toFixed(
							3
						)} / 평균 {data.mean.toFixed(3)} / 기준 {Number.isFinite(split.cut)
							? split.cut.toFixed(3)
							: '—'} · z {z.toFixed(1)} ·
						<a href={`/search?q=${encodeURIComponent(data.q)}${data.raw ? '' : '&raw=1'}`}
							>{data.raw ? '보정·묶기 켜기' : '모델 순서 그대로 보기'}</a
						></span
					>
				{/if}
			</p>
			{#if showWeak && split.weak.length > 0}<PhotoGrid items={split.weak} ctx="archive" />{/if}
		{/if}
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
	.more {
		margin: 24px 0 14px;
		font-size: 15px;
	}
	.nomatch {
		margin: 4px 0 14px;
		font-size: 16px;
		line-height: 1.6;
	}
	.more a {
		color: var(--color-amber);
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	.more button,
	.nomatch button {
		font: inherit;
		color: var(--color-amber);
		background: none;
		border: 0;
		cursor: pointer;
		text-decoration: underline;
		text-underline-offset: 3px;
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
