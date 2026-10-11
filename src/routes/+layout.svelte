<script lang="ts">
	import '../app.css';
	import '@fontsource/instrument-serif';
	import '@fontsource/instrument-serif/400-italic.css';
	import '@fontsource-variable/jetbrains-mono';
	import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
	import { page } from '$app/state';
	import favicon from '#lib/assets/favicon.svg';
	import Header from '#lib/components/Header.svelte';
	import type { OgMeta } from '#lib/og.ts';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	// 페이지가 load 에서 og 를 주면 그걸로, 아니면 사이트 기본값. 제목·미리보기 태그는 여기 한 군데서만 낸다.
	const og = $derived((page.data as { og?: OgMeta }).og ?? {});
	const title = $derived(og.title ? `${og.title} · ${data.site.title}` : data.site.title);
	const description = $derived(og.description || data.site.description);
	const image = $derived(og.image ?? data.defaultOgImage);
	const abs = (p: string) => (/^https?:/.test(p) ? p : `${data.origin}${p}`);
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>{title}</title>
	{#if description}<meta name="description" content={description} />{/if}
	<meta property="og:site_name" content={data.site.title} />
	<meta property="og:title" content={og.title ?? data.site.title} />
	{#if description}<meta property="og:description" content={description} />{/if}
	<meta property="og:type" content={og.type ?? 'website'} />
	<meta property="og:url" content={abs(page.url.pathname)} />
	{#if image}
		<meta property="og:image" content={abs(image)} />
		<meta name="twitter:card" content="summary_large_image" />
	{:else}
		<meta name="twitter:card" content="summary" />
	{/if}
	<link rel="canonical" href={abs(page.url.pathname)} />
</svelte:head>

<Header title={data.site.title} admin={data.admin} hasAbout={data.site.hasAbout} />
{@render children()}
