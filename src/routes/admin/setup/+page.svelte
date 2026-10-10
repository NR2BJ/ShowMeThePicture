<script lang="ts">
	import type { PageProps } from './$types';
	let { form }: PageProps = $props();
</script>

<section class="admin-page narrow">
	<h1>첫 관리자 만들기</h1>
	<p class="notice">
		아직 관리자 계정이 없습니다. 한 번만 만들 수 있고, 이후에는 로그인 화면만 보입니다.<br />
		앱 로그에 찍힌 <strong>설정 토큰</strong>이 필요합니다. Docker 라면
		<code>docker compose logs app | grep setup</code>
	</p>
	{#if form?.error}<p class="notice error">{form.error}</p>{/if}
	<form method="POST">
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
			><span>비밀번호 (8자 이상)</span><input
				type="password"
				name="password"
				autocomplete="new-password"
				required
			/></label
		>
		<label class="field"
			><span>비밀번호 확인</span><input
				type="password"
				name="confirm"
				autocomplete="new-password"
				required
			/></label
		>
		<label class="field"
			><span>설정 토큰</span><input type="text" name="token" autocomplete="off" required /></label
		>
		<button class="btn primary" type="submit">만들기</button>
	</form>
</section>

<style>
	.narrow {
		max-width: 420px;
	}
	code {
		font-family: var(--font-mono);
		font-size: 15px;
	}
</style>
