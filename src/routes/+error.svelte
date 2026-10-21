<script lang="ts">
	import { page } from '$app/state';
	// 오류 화면: 상태 코드와 (있으면) 오류 번호. 번호는 서버 로그의 [error 번호] / [client-error 번호] 와 같다.
	const notFound = $derived(page.status === 404);
</script>

<main class="err">
	<p class="code mono">{page.status}</p>
	<h1>{notFound ? '찾을 수 없는 페이지입니다' : '문제가 생겼습니다'}</h1>
	{#if !notFound}
		<p class="dim">
			잠시 뒤 다시 불러오면 대개 해결됩니다{#if page.error?.id}
				· 오류 번호 <span class="mono">{page.error.id}</span>{/if}
		</p>
	{/if}
	<div class="acts">
		{#if !notFound}<button class="btn" type="button" onclick={() => location.reload()}
				>다시 불러오기</button
			>{/if}
		<a class="btn quiet" href="/archive">아카이브로</a>
	</div>
</main>

<style>
	.err {
		max-width: 640px;
		margin: 12vh auto 0;
		padding: 0 24px;
	}
	.code {
		font-size: 15px;
		letter-spacing: 0.16em;
		color: var(--color-amber);
		margin: 0 0 8px;
	}
	h1 {
		font-family: var(--font-serif);
		font-weight: 400;
		font-size: clamp(32px, 6vw, 48px);
		line-height: 1.1;
		margin: 0 0 14px;
	}
	.dim {
		font-size: 17px;
		margin: 0 0 24px;
	}
	.acts {
		display: flex;
		gap: 10px;
		flex-wrap: wrap;
	}
</style>
