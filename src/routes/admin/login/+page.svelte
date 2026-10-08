<script lang="ts">
	import type { PageProps } from './$types';
	let { data, form }: PageProps = $props();
</script>

<section class="admin-page narrow">
	<h1>관리자</h1>
	{#if data.noDb}
		<p class="notice error">
			DATABASE_URL 이 설정되지 않았습니다. 로컬 개발이면 .env 를 확인하세요.
		</p>
	{:else}
		{#if form?.error}<p class="notice error">{form.error}</p>{/if}
		<form method="POST">
			<input type="hidden" name="next" value={data.next} />
			<label class="field"
				><span>아이디</span><input
					type="text"
					name="username"
					autocomplete="username"
					value={form?.username ?? ''}
					required
				/></label
			>
			<label class="field"
				><span>비밀번호</span><input
					type="password"
					name="password"
					autocomplete="current-password"
					required
				/></label
			>
			<button class="btn primary" type="submit">로그인</button>
		</form>
	{/if}
</section>

<style>
	.narrow {
		max-width: 420px;
	}
</style>
