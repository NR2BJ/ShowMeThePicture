<script lang="ts">
	import { SEARCH_MODELS, needsLanguage } from '#lib/search.ts';
	import type { PageProps } from './$types';
	let { data, form }: PageProps = $props();
	// svelte-ignore state_referenced_locally
	let stripVh = $state(data.stripVh);
	// svelte-ignore state_referenced_locally
	let stripRows = $state(data.stripRows);
	// svelte-ignore state_referenced_locally
	let searchModel = $state(data.searchModel);
</script>

<section class="admin-page">
	<h1>설정</h1>
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

		<h2>검색</h2>
		<p class="mono dim status">
			ML 서버 {data.ml.url} · {data.ml.up ? '연결됨' : '연결 안 됨'} · 임베딩 {data.embed.done} / {data
				.embed.total}장 ({data.embed.model})
		</p>
		<label class="field">
			<span>임베딩 모델</span>
			<select name="searchModel" bind:value={searchModel}>
				{#if !SEARCH_MODELS.some((m) => m.id === data.searchModel)}
					<option value={data.searchModel}>{data.searchModel} (예전 값)</option>
				{/if}
				{#each SEARCH_MODELS as m (m.id)}
					<option value={m.id}>{m.label} — {m.note} · {m.id}</option>
				{/each}
			</select>
		</label>
		{#if needsLanguage(searchModel)}
			<label class="field"
				><span>질의 언어 코드 (NLLB)</span><input
					type="text"
					name="searchLanguage"
					value={data.searchLanguage}
				/></label
			>
		{:else}
			<input type="hidden" name="searchLanguage" value={data.searchLanguage} />
		{/if}

		<h2>사진 페이지</h2>
		<label class="check mono"
			><input type="checkbox" name="showGps" checked={data.showGps} /> 게스트에게도 GPS 좌표 보이기</label
		>
		<button class="btn primary" type="submit" disabled={data.noDb}>저장</button>
	</form>
	<form
		method="POST"
		action="?/reembed"
		class="reembed"
		onsubmit={(e) => {
			if (!confirm('현재 모델로 임베딩이 없는 사진을 전부 큐에 넣을까요?')) e.preventDefault();
		}}
	>
		<button class="btn quiet" type="submit" disabled={data.noDb}>빠진 임베딩 채우기</button>
	</form>
</section>

<style>
	.status {
		font-size: 14px;
		margin: -4px 0 12px;
	}
	.reembed {
		margin-top: 14px;
	}
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
		font-size: 16px;
		margin: 4px 0;
	}
	.check {
		display: flex;
		gap: 8px;
		align-items: center;
		font-size: 16px;
		margin: 2px 0 16px;
	}
</style>
