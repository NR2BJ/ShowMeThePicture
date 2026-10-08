<script lang="ts">
	import { page } from '$app/state';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();
	const links = [
		{ href: '/admin', label: '대시보드', exact: true },
		{ href: '/admin/sources', label: '라이브러리' },
		{ href: '/admin/folders', label: '폴더 정보' },
		{ href: '/admin/pairs', label: '페어링' },
		{ href: '/admin/collections', label: '컬렉션' }
	];
	function current(href: string, exact?: boolean) {
		return exact ? page.url.pathname === href : page.url.pathname.startsWith(href);
	}
</script>

{#if data.admin}
	<nav class="admin-nav" aria-label="관리자 메뉴">
		{#each links as l (l.href)}
			<a href={l.href} aria-current={current(l.href, l.exact) ? 'page' : undefined}>{l.label}</a>
		{/each}
		<a href="/">사이트로 →</a>
		<form method="POST" action="/admin/logout">
			<button class="btn quiet" type="submit">로그아웃 · {data.admin.username}</button>
		</form>
	</nav>
{/if}

{@render children()}
