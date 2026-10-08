<script lang="ts">
	import '../app.css';
	import '@fontsource/instrument-serif';
	import '@fontsource/instrument-serif/400-italic.css';
	import '@fontsource-variable/jetbrains-mono';
	import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
	import favicon from '#lib/assets/favicon.svg';
	import Header from '#lib/components/Header.svelte';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>{data.site.title}</title>
</svelte:head>

<Header title={data.site.title} />
{@render children()}
