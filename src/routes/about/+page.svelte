<script lang="ts">
	import type { PageProps } from './$types';
	let { data }: PageProps = $props();
</script>

<section class="page">
	<h1>소개</h1>
	{#if data.empty}
		<p class="mono dim">
			아직 소개 글이 없습니다. <a href="/admin/settings">설정</a>의 '소개 글'에 쓰면 여기와 메뉴에
			나타납니다.
		</p>
	{:else}
		<!-- eslint-disable-next-line svelte/no-at-html-tags -- renderMarkdown 이 HTML 을 이스케이프한다 -->
		<div class="prose">{@html data.html}</div>
	{/if}
</section>

<style>
	.page {
		padding: 8px 40px 100px;
		max-width: 760px;
	}
	h1 {
		font-family: var(--font-serif);
		font-weight: 400;
		font-size: clamp(40px, 6vw, 84px);
		line-height: 1;
		margin: 12px 0 40px;
	}
	.prose {
		font-size: 20px;
		line-height: 1.8;
		color: var(--color-ink);
	}
	.prose :global(h2),
	.prose :global(h3),
	.prose :global(h4) {
		font-family: var(--font-serif);
		font-weight: 400;
		margin: 1.6em 0 0.4em;
	}
	.prose :global(h2) {
		font-size: 36px;
	}
	.prose :global(h3) {
		font-size: 28px;
	}
	.prose :global(p),
	.prose :global(ul) {
		margin: 0 0 1em;
	}
	.prose :global(a) {
		color: var(--color-amber);
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	.dim a {
		color: var(--color-amber);
	}
	@media (max-width: 720px) {
		.page {
			padding: 8px 16px 60px;
		}
		.prose {
			font-size: 18px;
		}
	}
</style>
