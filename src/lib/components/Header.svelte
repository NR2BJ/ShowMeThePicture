<script lang="ts">
	import { page } from '$app/state';

	let {
		title,
		admin = null,
		hasAbout = false
	}: { title: string; admin?: { username: string } | null; hasAbout?: boolean } = $props();

	// 소개 글이 비어 있으면 게스트에게는 '소개'를 숨긴다 (관리자는 쓰러 들어갈 수 있게 보임)
	const links = $derived([
		{ href: '/collections', label: '컬렉션' },
		{ href: '/archive', label: '아카이브' },
		{ href: '/search', label: '검색' },
		...(hasAbout || admin ? [{ href: '/about', label: '소개' }] : [])
	]);
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
				width="17"
				height="17"
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
		font-size: 40px;
		line-height: 1;
		letter-spacing: 0.005em;
	}
	nav {
		display: flex;
		gap: 28px;
		align-items: baseline;
	}
	nav a {
		font-size: 20px;
		letter-spacing: 0.01em;
		color: var(--color-ink-soft);
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
		color: var(--color-ink-soft);
	}
	nav .admin:hover {
		color: var(--color-ink);
	}
	nav .admin.on {
		color: var(--color-amber);
	}
	nav a,
	.brand {
		white-space: nowrap;
	}
	/* 폰: 제목 한 줄, 그 밑에 메뉴 한 줄. 관리자는 열쇠 아이콘만 */
	@media (max-width: 720px) {
		header {
			flex-wrap: wrap;
			align-items: center;
			gap: 10px 16px;
			padding: 14px 16px;
		}
		.brand {
			font-size: 26px;
		}
		nav {
			gap: 18px;
			flex: 1 0 100%;
			align-items: center;
		}
		nav a {
			font-size: 17px;
		}
		nav .admin {
			margin-left: auto;
			padding-left: 12px;
		}
		nav .admin span {
			display: none;
		}
	}
</style>
