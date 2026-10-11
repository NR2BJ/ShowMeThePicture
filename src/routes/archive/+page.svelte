<script lang="ts">
	// 아카이브: 공개 사진 전체(관리자는 숨김 포함) 피드
	import ArchiveFeed, { type FeedSnapshot } from '#lib/components/ArchiveFeed.svelte';
	import { archiveCtx } from '#lib/archive.ts';
	import type { PageProps, Snapshot } from './$types';

	let { data }: PageProps = $props();
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
	basePath="/archive"
	ctx={archiveCtx(data.filter)}
	emptyNote="아직 공개된 사진이 없습니다."
>
	{#snippet head()}<h1>아카이브</h1>{/snippet}
</ArchiveFeed>
