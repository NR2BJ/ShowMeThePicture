<script lang="ts">
	import type { PageProps } from './$types';
	let { data, form }: PageProps = $props();
	// svelte-ignore state_referenced_locally
	let stripVh = $state(data.stripVh);
	// svelte-ignore state_referenced_locally
	let stripRows = $state(data.stripRows);
</script>

<section class="admin-page">
	<h1>설정</h1>
	<p class="mono dim">사이트 전체에 적용되는 값입니다. DB 에 저장되어 재배포해도 유지됩니다.</p>
	{#if form?.error}<p class="notice error">{form.error}</p>{/if}
	{#if form?.ok}<p class="notice">{form.ok}</p>{/if}

	<form method="POST" action="?/save" class="edit">
		<h2>랜딩</h2>
		<div class="field">
			<span>필름 스트립에 보일 컷</span>
			<label class="radio mono"
				><input type="radio" name="landingTiers" value="A" checked={data.landingTiers !== 'AB'} /> A컷만</label
			>
			<label class="radio mono"
				><input type="radio" name="landingTiers" value="AB" checked={data.landingTiers === 'AB'} /> A컷
				+ B컷</label
			>
		</div>
		<div class="field">
			<span
				>필름 프레임 크기 <output class="mono" for="stripVh">{stripVh}</output>%
				<span class="dim">(화면 높이 기준)</span></span
			>
			<input
				id="stripVh"
				type="range"
				name="stripVh"
				min="5"
				max="50"
				step="1"
				bind:value={stripVh}
			/>
		</div>
		<div class="field">
			<span>필름 줄 수 <output class="mono" for="stripRows">{stripRows}</output></span>
			<input
				id="stripRows"
				type="range"
				name="stripRows"
				min="1"
				max="10"
				step="1"
				bind:value={stripRows}
			/>
		</div>
		<p class="mono dim hint">
			줄 수 × 크기가 화면을 넘으면 위아래가 잘린 채 흐릅니다(세 줄이면 대략 22% 까지). 저장하면
			게스트에게도 같은 크기로 보입니다.
		</p>
		<p class="mono dim hint">
			공개 상태인 보정본 중에서 무작위로 고릅니다. 보정본 없이 원본만 있는 사진은 랜딩에 나오지
			않습니다.
		</p>

		<h2>사진 페이지</h2>
		<label class="check mono"
			><input type="checkbox" name="showGps" checked={data.showGps} /> 게스트에게도 GPS 좌표 보이기</label
		>
		<button class="btn primary" type="submit" disabled={data.noDb}>저장</button>
	</form>
</section>

<style>
	input[type='range'] {
		width: min(100%, 420px);
		accent-color: var(--color-amber);
	}
	.edit {
		max-width: 760px;
	}
	.radio {
		display: flex;
		gap: 8px;
		align-items: center;
		font-size: 13px;
		margin: 4px 0;
	}
	.hint {
		font-size: 12px;
		margin: -2px 0 18px;
		max-width: 760px;
	}
	.check {
		display: flex;
		gap: 8px;
		align-items: center;
		font-size: 13px;
		margin: 2px 0 16px;
	}
</style>
