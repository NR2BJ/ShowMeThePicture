<script lang="ts">
	// 설정: 저장 버튼 없이 바꾸는 즉시 저장(use:enhance 라 새로고침 없음). 모델 시험은 오래 걸리므로 진행 중 표시.
	import { enhance, type SubmitFunction } from '$app/forms';
	import { SEARCH_MODELS, needsLanguage } from '#lib/search.ts';
	import type { PageProps } from './$types';
	let { data, form }: PageProps = $props();

	// svelte-ignore state_referenced_locally
	let stripVh = $state(data.stripVh);
	// svelte-ignore state_referenced_locally
	let stripRows = $state(data.stripRows);
	// svelte-ignore state_referenced_locally
	let searchModel = $state(data.searchModel);
	let saving = $state(false);
	let testing = $state(false);
	let working = $state(false);

	const submit = (e: Event) => (e.currentTarget as HTMLElement).closest('form')?.requestSubmit();
	const track =
		(set: (v: boolean) => void): SubmitFunction =>
		() => {
			set(true);
			return async ({ update }) => {
				await update({ reset: false });
				set(false);
			};
		};
</script>

<section class="admin-page">
	<h1>
		설정
		<span class="mono dim live">
			{#if saving}저장 중…{:else if form?.ok && !form.error}바꾸면 바로 저장됩니다 · 저장됨{:else}바꾸면
				바로 저장됩니다{/if}
		</span>
	</h1>
	{#if form?.error}<p class="notice error">{form.error}</p>{/if}
	{#if form?.ok}<p class="notice">{form.ok}</p>{/if}

	<form method="POST" action="?/save" class="edit" use:enhance={track((v) => (saving = v))}>
		<h2>랜딩</h2>
		<div class="field">
			<span>필름 스트립에 보일 컷</span>
			<label class="radio mono"
				><input
					type="radio"
					name="landingTiers"
					value="A"
					checked={data.landingTiers !== 'AB'}
					onchange={submit}
				/> A컷만</label
			>
			<label class="radio mono"
				><input
					type="radio"
					name="landingTiers"
					value="AB"
					checked={data.landingTiers === 'AB'}
					onchange={submit}
				/> A컷 + B컷</label
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
				onchange={submit}
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
				onchange={submit}
			/>
		</div>

		<h2>검색</h2>
		<p class="mono dim status">
			ML 서버 {data.ml.url} · {data.ml.up ? '연결됨' : '연결 안 됨'} · 임베딩 {data.embed.done} / {data
				.embed.total}장 ({data.embed.model}){#if data.embed.other}
				· 다른 모델 것 {data.embed.other}개{/if}
		</p>
		<label class="field">
			<span>임베딩 모델</span>
			<select name="searchModel" bind:value={searchModel} onchange={submit}>
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
				><span>질의 기본 언어 (NLLB · ko, en, ja, zh-CN — 글자로 알 수 있으면 자동)</span><input
					type="text"
					name="searchLanguage"
					value={data.searchLanguage}
					onchange={submit}
				/></label
			>
		{:else}
			<input type="hidden" name="searchLanguage" value={data.searchLanguage} />
		{/if}

		<h2>사진 페이지</h2>
		<label class="check mono"
			><input type="checkbox" name="showGps" checked={data.showGps} onchange={submit} /> 게스트에게도
			GPS 좌표 보이기</label
		>
	</form>

	<h2>받아 둔 모델</h2>
	{#if data.modelCaches === null}
		<p class="mono dim status">
			ml 컨테이너의 모델 캐시가 app 에 안 붙어 있습니다. compose 의 app 서비스에 ml-cache 볼륨을
			/mlcache 로 마운트하고 ML_CACHE_DIR=/mlcache 를 주면 여기서 용량을 보고 지울 수 있습니다.
		</p>
	{:else if data.modelCaches.length === 0}
		<p class="mono dim status">아직 받아 둔 모델이 없습니다.</p>
	{:else}
		<table class="table caches">
			<thead><tr><th>모델</th><th>용량</th><th>글 / 사진</th><th></th></tr></thead>
			<tbody>
				{#each data.modelCaches as m (m.name)}
					<tr>
						<td class="mono"
							>{m.name}{#if m.name === data.searchModel}
								<span class="dim"> · 사용 중</span>{/if}</td
						>
						<td class="mono">{m.size}</td>
						<td class="mono dim">{m.textual ? '글' : '-'} / {m.visual ? '사진' : '-'}</td>
						<td class="actions">
							{#if m.name !== data.searchModel}
								<form
									method="POST"
									action="?/deleteModelCache"
									use:enhance={track((v) => (working = v))}
									onsubmit={(e) => {
										if (
											!confirm(`${m.name} 캐시(${m.size})를 지울까요? 다시 고르면 다시 받습니다.`)
										)
											e.preventDefault();
									}}
								>
									<input type="hidden" name="name" value={m.name} />
									<button class="btn danger" type="submit" disabled={working}>지우기</button>
								</form>
							{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}

	<h2>임베딩</h2>
	<div class="acts">
		<form method="POST" action="?/testModel" use:enhance={track((v) => (testing = v))}>
			<button class="btn quiet" type="submit" disabled={data.noDb || testing}
				>{testing ? '시험 중…' : '모델 시험 (글 1줄 + 사진 1장)'}</button
			>
		</form>
		<form
			method="POST"
			action="?/reembed"
			use:enhance={track((v) => (working = v))}
			onsubmit={(e) => {
				if (!confirm('현재 모델로 임베딩이 없는 사진을 전부 큐에 넣을까요?')) e.preventDefault();
			}}
		>
			<button class="btn quiet" type="submit" disabled={data.noDb || working}
				>빠진 임베딩 채우기</button
			>
		</form>
		<form
			method="POST"
			action="?/clearEmbeddings"
			use:enhance={track((v) => (working = v))}
			onsubmit={(e) => {
				if (
					!confirm(
						'임베딩을 전부 지울까요? 검색과 비슷한 사진이 비고, 다시 채우려면 전부 다시 계산합니다.'
					)
				)
					e.preventDefault();
			}}
		>
			<button class="btn danger" type="submit" disabled={data.noDb || working}
				>임베딩 전부 지우기</button
			>
		</form>
	</div>
	{#if testing}
		<p class="mono dim status">
			시험 중입니다. 처음 고른 모델은 내려받기와 GPU 로딩 때문에 몇 분 걸릴 수 있습니다 — 끝나면
			위에 결과가 뜹니다. ml 컨테이너 로그(docker logs -f)에서 진행을 볼 수 있습니다.
		</p>
	{/if}
</section>

<style>
	input[type='range'] {
		width: min(100%, 420px);
		accent-color: var(--color-amber);
	}
	.live {
		font-size: 13px;
		letter-spacing: 0.08em;
		margin-left: 12px;
		vertical-align: middle;
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
	.status {
		font-size: 15px;
		margin: -4px 0 12px;
		max-width: 760px;
	}
	.acts {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
		margin: 0 0 12px;
	}
	.caches {
		max-width: 900px;
		margin: 0 0 20px;
	}
	.caches td.actions {
		white-space: nowrap;
		text-align: right;
	}
</style>
