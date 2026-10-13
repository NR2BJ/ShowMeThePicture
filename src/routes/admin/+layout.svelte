<script lang="ts">
	import { page } from '$app/state';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();
	const links = [
		{ href: '/admin', label: '대시보드', exact: true },
		{ href: '/admin/sources', label: '라이브러리' },
		{ href: '/admin/film', label: '필름' },
		{ href: '/admin/gear', label: '장비' },
		{ href: '/admin/pairs', label: '페어링' },
		{ href: '/admin/collections', label: '컬렉션' },
		{ href: '/admin/visibility', label: '직접 바꾼 사진' },
		{ href: '/admin/stats', label: '방문' },
		{ href: '/admin/settings', label: '설정' }
	];
	function current(href: string, exact?: boolean) {
		return exact ? page.url.pathname === href : page.url.pathname.startsWith(href);
	}
	// 폰: 메뉴가 옆으로 밀리는 한 줄이라, 지금 탭이 화면 밖이면 보이는 자리로 당겨 온다
	let nav: HTMLElement | undefined = $state();
	$effect(() => {
		void page.url.pathname;
		nav
			?.querySelector('[aria-current="page"]')
			?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
	});
</script>

{#if data.admin}
	<nav class="admin-nav" aria-label="관리자 메뉴" bind:this={nav}>
		{#each links as l (l.href)}
			<a href={l.href} aria-current={current(l.href, l.exact) ? 'page' : undefined}>{l.label}</a>
		{/each}
		<form method="POST" action="/admin/logout">
			<button class="logout" type="submit">로그아웃</button>
		</form>
	</nav>
{/if}

{@render children()}
