<script lang="ts">
	import { page } from '$app/state';

	let { title, admin = null }: { title: string; admin?: { username: string } | null } = $props();

	const links = [
		{ href: '/collections', label: '컬렉션' },
		{ href: '/archive', label: '아카이브' },
		{ href: '/search', label: '검색' },
		{ href: '/about', label: '소개' }
	];
	const onLanding = $derived(page.url.pathname === '/');
</script>

<header class:overlay={onLanding}>
	<a class="brand" href="/">{title}</a>
	<nav aria-label="주 메뉴">
		{#each links as l (l.href)}
			<a href={l.href} aria-current={page.url.pathname.startsWith(l.href) ? 'page' : undefined}>
				{l.label}
			</a>
		{/each}
		<a
			class="admin"
			class:on={!!admin}
			href={admin ? '/admin' : '/admin/login'}
			title={admin ? '관리자 페이지' : '관리자 로그인'}
		>
			<svg
				width="13"
				height="13"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="1.8"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
			>
				<circle cx="8" cy="15" r="4" /><path d="M10.9 12.1 21 2M15 8l3 3M18 5l3 3" />
			</svg>
			<span>{admin ? admin.username : '관리자'}</span>
		</a>
	</nav>
</header>

<style>
	header {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		padding: 28px 40px;
		position: sticky;
		top: 0;
		z-index: 10;
		background: color-mix(in srgb, var(--color-bg) 88%, transparent);
		backdrop-filter: blur(10px);
	}
	header.overlay {
		position: fixed;
		inset: 0 0 auto 0;
		background: transparent;
		backdrop-filter: none;
	}
	.brand {
		font-family: var(--font-serif);
		font-size: 30px;
		line-height: 1;
		letter-spacing: 0.005em;
	}
	nav {
		display: flex;
		gap: 28px;
		align-items: baseline;
	}
	nav a {
		font-size: 14px;
		letter-spacing: 0.02em;
		color: var(--color-ink-dim);
		transition: color 0.2s;
	}
	nav a:hover,
	nav a[aria-current='page'] {
		color: var(--color-ink);
	}
	nav .admin {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		margin-left: 10px;
		padding-left: 14px;
		border-left: 1px solid var(--color-ink-faint);
		color: var(--color-ink-dim);
	}
	nav .admin:hover {
		color: var(--color-ink);
	}
	nav .admin.on {
		color: var(--color-amber);
	}
	@media (max-width: 720px) {
		header {
			padding: 18px 20px;
		}
		.brand {
			font-size: 24px;
		}
		nav {
			gap: 16px;
		}
		nav a {
			font-size: 13px;
		}
	}
</style>
