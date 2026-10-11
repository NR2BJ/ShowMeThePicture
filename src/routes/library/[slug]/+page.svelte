<script lang="ts">
	// 폴더 페이지(관리자 전용): 아카이브와 같은 피드 — 이 폴더의 파일만, 썸네일도 이 폴더 파일(RAW 우선)
	import ArchiveFeed, { type FeedSnapshot } from '#lib/components/ArchiveFeed.svelte';
	import type { PageProps, Snapshot } from './$types';

	let { data }: PageProps = $props();
	// 사진 페이지 이전/다음·Esc 가 필터를 유지하도록 ctx 에 query 를 싣는다
	const ctx = $derived(`library:${data.source.slug}${data.query ? `?${data.query}` : ''}`);
	let feed: ReturnType<typeof ArchiveFeed> | undefined = $state();
	export const snapshot: Snapshot<FeedSnapshot | null> = {
		capture: () => feed?.capture() ?? null,
		restore: (v) => {
			if (v) feed?.restore(v);
		}
	};
</script>

<ArchiveFeed
	bind:this={feed}
	{data}
	basePath={`/library/${data.source.slug}`}
	{ctx}
	apiExtra={`source=${encodeURIComponent(data.source.slug)}`}
	emptyNote="아직 처리된 사진이 없습니다. 스캔과 파생본 생성이 끝나면 여기에 나타납니다."
>
	{#snippet head()}
		<p class="mono dim kicker">
			라이브러리 · {data.source.role === 'edit' ? '보정' : '원본'}{data.source.medium
				? ` · ${data.source.medium === 'film' ? '필름' : '디지털'}`
				: ''}{data.source.tier ? ` · ${data.source.tier}컷` : ''}
		</p>
		<h1>{data.source.name}</h1>
		<p class="mono dim path">{data.source.rootPath}</p>
	{/snippet}
	{#snippet meta()}&nbsp;· 관리자 전용{/snippet}
</ArchiveFeed>

<style>
	.kicker {
		font-size: 15px;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		margin: 0 0 8px;
	}
	.path {
		font-size: 15px;
		margin: 12px 0 0;
	}
</style>
