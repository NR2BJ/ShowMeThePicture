<script lang="ts">
	import FormatSelect from '#lib/components/FormatSelect.svelte';
	import type { PageProps } from './$types';
	let { data, form }: PageProps = $props();
	let kind = $state<'camera' | 'lens' | 'film'>('camera');
	const kinds = [
		['camera', '카메라'],
		['lens', '렌즈'],
		['film', '필름']
	] as const;
	const label = (k: string) => kinds.find((x) => x[0] === k)?.[1] ?? k;
</script>

<section class="admin-page">
	<h1>장비</h1>
	<p class="mono dim">
		가진 카메라·렌즈·필름을 등록해 두면 롤 폴더명에서 자동으로 찾아내고(띄어쓰기·대소문자 무시, 별칭
		가능), 폴더 정보와 사진별 수정에서 드롭다운으로 고릅니다. 고정렌즈 바디는 렌즈를 적어 두면
		자동으로 채워집니다. 포맷은 프리셋(1" · M4/3 · APS-C · FF / 135 하프·풀 /
		645·6x6·6x7·6x8·6x9·6x17 / 4x5·8x10)에서 고르고, 없는 건 '기타'로 직접 씁니다. 조리개·셔터 같은
		노출 값은 필름에서는 다루지 않습니다.
	</p>
	{#if form?.error}<p class="notice error">{form.error}</p>{/if}
	{#if form?.ok}<p class="notice">{form.ok}</p>{/if}
	<form method="POST" action="?/reparse">
		<button class="btn quiet" type="submit">폴더명 다시 읽기 (빈 칸만 채움)</button>
	</form>

	{#each kinds as [k, kl] (k)}
		<h2>{kl}</h2>
		{#if data.gear.filter((g) => g.kind === k).length === 0}
			<p class="dim">없음</p>
		{:else}
			<table class="table">
				<thead
					><tr
						><th>이름</th><th>별칭</th>{#if k === 'camera'}<th>고정 렌즈</th>{/if}<th>포맷</th><th
							>메모</th
						><th></th></tr
					></thead
				>
				<tbody>
					{#each data.gear.filter((g) => g.kind === k) as g (g.id)}
						<tr>
							<td>{g.name}</td>
							<td class="mono dim">{(g.aliases ?? []).join(', ')}</td>
							{#if k === 'camera'}<td class="mono">{g.fixedLens ?? '-'}</td>{/if}
							<td class="mono">{g.format ?? '-'}</td>
							<td class="mono dim">{g.notes ?? ''}</td>
							<td
								><form method="POST" action="?/delete">
									<input type="hidden" name="id" value={g.id} /><button
										class="btn danger"
										type="submit">삭제</button
									>
								</form></td
							>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	{/each}

	<h2>추가</h2>
	<form method="POST" action="?/add" class="add">
		<div class="cols">
			<label class="field"
				><span>종류</span>
				<select name="kind" bind:value={kind}>
					{#each kinds as [k, kl] (k)}<option value={k}>{kl}</option>{/each}
				</select>
			</label>
			<label class="field"
				><span>이름 (표시용)</span><input
					type="text"
					name="name"
					required
					placeholder={kind === 'film'
						? '예: Kodak ColorPlus 200'
						: kind === 'lens'
							? '예: Nikkor 50mm f/1.4'
							: '예: Rollei 35S'}
				/></label
			>
			<label class="field"
				><span>별칭 (쉼표로 구분, 폴더명에서 찾을 때)</span><input
					type="text"
					name="aliases"
					placeholder={kind === 'film' ? '예: colorplus200, colorplus' : '예: rollei35s'}
				/></label
			>
			{#if kind === 'camera'}
				<label class="field"
					><span>고정 렌즈 (있으면)</span><input
						type="text"
						name="fixedLens"
						placeholder="예: Sonnar 40mm f/2.8"
					/></label
				>
			{/if}
			<div class="field">
				<span>포맷</span>
				{#key kind}
					<FormatSelect name="format" kind={kind === 'film' ? 'film' : 'any'} />
				{/key}
			</div>
			<label class="field"><span>메모</span><input type="text" name="notes" /></label>
		</div>
		<button class="btn primary" type="submit">{label(kind)} 추가</button>
	</form>
</section>

<style>
	.add {
		max-width: 820px;
	}
	.cols {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 0 16px;
	}
</style>
