<script lang="ts">
	import FormatInput from '#lib/components/FormatInput.svelte';
	import type { PageProps } from './$types';
	let { data, form }: PageProps = $props();
	type Gear = (typeof data.gear)[number];
	let kind = $state<'camera' | 'lens' | 'film'>('camera');
	const kinds = [
		['camera', '카메라'],
		['lens', '렌즈'],
		['film', '필름']
	] as const;
	const label = (k: string) => kinds.find((x) => x[0] === k)?.[1] ?? k;
	// 한 표에 종류 순(카메라 → 렌즈 → 필름)으로 — 열이 같아야 버튼이 한 줄에 맞는다
	const order: Record<string, number> = { camera: 0, lens: 1, film: 2 };
	const rows = $derived(
		[...data.gear].sort((a, b) => order[a.kind] - order[b.kind] || a.name.localeCompare(b.name))
	);
	// '수정'으로 펼친 행
	let open = $state<Record<string, boolean>>({});
</script>

{#snippet editForm(g: Gear)}
	<form method="POST" action="?/update" class="edit">
		<input type="hidden" name="id" value={g.id} />
		<div class="cols">
			<label class="field"
				><span>이름 (표시용)</span><input type="text" name="name" value={g.name} required /></label
			>
			<label class="field"
				><span>별칭 (쉼표로 구분, 폴더명에서 찾을 때)</span><input
					type="text"
					name="aliases"
					value={(g.aliases ?? []).join(', ')}
				/></label
			>
			{#if g.kind === 'camera'}
				<label class="field"
					><span>고정 렌즈 (있으면)</span><input
						type="text"
						name="fixedLens"
						value={g.fixedLens ?? ''}
					/></label
				>
			{/if}
			<label class="field"
				><span>포맷</span><FormatInput
					name="format"
					value={g.format}
					kind={g.kind === 'film' ? 'film' : 'any'}
				/></label
			>
			<label class="field"
				><span>메모</span><input type="text" name="notes" value={g.notes ?? ''} /></label
			>
		</div>
		<div class="acts">
			<button class="btn" type="submit">저장</button>
			<button class="btn quiet" type="button" onclick={() => (open[g.id] = false)}>닫기</button>
		</div>
	</form>
{/snippet}

<section class="admin-page">
	<h1>장비</h1>
	<p class="mono dim">
		가진 카메라·렌즈·필름을 등록해 두면 롤 폴더명에서 자동으로 찾아내고(띄어쓰기·대소문자 무시, 별칭
		가능), 폴더 정보와 사진별 수정에서 드롭다운으로 고릅니다. 고정렌즈 바디는 렌즈를 적어 두면
		자동으로 채워집니다. 포맷 칸은 프리셋(1" · M4/3 · APS-C · FF · 4433 / 135 하프·풀 /
		645·6x6·6x7·6x8·6x9·6x17 / 4x5·8x10)이 뜨는 입력칸이라 고르거나 바로 씁니다. 조리개·셔터 같은
		노출 값은 필름에서는 다루지 않습니다.
	</p>
	{#if form?.error}<p class="notice error">{form.error}</p>{/if}
	{#if form?.ok}<p class="notice">{form.ok}</p>{/if}
	<form method="POST" action="?/reparse">
		<button class="btn quiet" type="submit">폴더명 다시 읽기 (빈 칸만 채움)</button>
	</form>

	<h2>등록된 장비</h2>
	{#if rows.length === 0}
		<p class="dim">없음</p>
	{:else}
		<table class="table gear">
			<colgroup>
				<col style="width: 8%" />
				<col style="width: 24%" />
				<col style="width: 18%" />
				<col style="width: 17%" />
				<col style="width: 10%" />
				<col />
				<col style="width: 1%" />
			</colgroup>
			<thead>
				<tr>
					<th>종류</th>
					<th>이름</th>
					<th>별칭</th>
					<th>고정 렌즈</th>
					<th>포맷</th>
					<th>메모</th>
					<th></th>
				</tr>
			</thead>
			<tbody>
				{#each rows as g (g.id)}
					<tr>
						<td class="mono dim">{label(g.kind)}</td>
						<td class="wrap">{g.name}</td>
						<td class="mono dim wrap">{(g.aliases ?? []).join(', ')}</td>
						<td class="mono wrap">{g.kind === 'camera' ? (g.fixedLens ?? '-') : ''}</td>
						<td class="mono">{g.format ?? '-'}</td>
						<td class="dim wrap">{g.notes ?? ''}</td>
						<td class="actions">
							<button class="btn quiet" type="button" onclick={() => (open[g.id] = !open[g.id])}
								>{open[g.id] ? '접기' : '수정'}</button
							>
							<form
								method="POST"
								action="?/delete"
								onsubmit={(e) => {
									if (
										!confirm(
											`'${g.name}' 을(를) 지울까요? 이미 채워진 폴더/사진 값은 그대로 남습니다.`
										)
									)
										e.preventDefault();
								}}
							>
								<input type="hidden" name="id" value={g.id} /><button
									class="btn danger"
									type="submit">삭제</button
								>
							</form>
						</td>
					</tr>
					{#if open[g.id]}
						<tr class="editrow"><td colspan="7">{@render editForm(g)}</td></tr>
					{/if}
				{/each}
			</tbody>
		</table>
	{/if}

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
			<label class="field"
				><span>포맷</span>
				{#key kind}
					<FormatInput name="format" kind={kind === 'film' ? 'film' : 'any'} />
				{/key}
			</label>
			<label class="field"><span>메모</span><input type="text" name="notes" /></label>
		</div>
		<button class="btn primary" type="submit">{label(kind)} 추가</button>
	</form>
</section>

<style>
	.add,
	.edit {
		max-width: 1100px;
	}
	.cols {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 0 16px;
	}
	/* 열 너비를 고정해 메모가 비어도 여백이 멋대로 흩어지지 않고, 길면 그 칸 안에서 줄바꿈 */
	.gear {
		table-layout: fixed;
	}
	.gear td.wrap {
		white-space: normal;
		overflow-wrap: anywhere;
	}
	.gear td.actions {
		display: flex;
		gap: 6px;
		justify-content: flex-end;
		white-space: nowrap;
	}
	.editrow td {
		background: rgba(255, 255, 255, 0.02);
	}
	.acts {
		display: flex;
		gap: 8px;
	}
</style>
