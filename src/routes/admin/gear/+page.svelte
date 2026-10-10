<script lang="ts">
	import FormatSelect from '#lib/components/FormatSelect.svelte';
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
	// 한 표에 종류 순(카메라 → 렌즈 → 필름), 종류 안에서는 position 순 — 서버 정렬(listGear) 그대로
	const rows = $derived(data.gear);
	const isFirst = (i: number) => i === 0 || rows[i - 1].kind !== rows[i].kind;
	const isLast = (i: number) => i === rows.length - 1 || rows[i + 1].kind !== rows[i].kind;
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
				><span>포맷</span><FormatSelect
					name="format"
					value={g.format}
					kind={g.kind === 'film' ? 'film' : 'any'}
				/></label
			>
			<label class="field wide"
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
		가진 카메라·렌즈·필름을 등록해 두면 롤 폴더명에서 자동으로 찾아내고, 폴더 정보와 사진별 수정에서
		드롭다운으로 고릅니다. 폴더명은 띄어쓰기·대소문자를 무시하고 찾고, 브랜드를 뺀
		나머지(colorplus200)나 유독 긴 단어 하나(ultramax)만 있어도 잡힙니다 — 못 찾으면 폴더 정보에서
		손으로 고르면 됩니다. 고정렌즈 바디는 렌즈를 적어 두면 폴더 정보에서 그 카메라를 고를 때 렌즈가
		자동으로 잠깁니다. 포맷은 디지털은 센서(1" 이하 · 1" · 4/3 · APS-C · APS-H · FF · 4433), 필름은
		규격(110 · 135 · 120 · 220 · 4x5 · 8x10)만 고릅니다 — 하프/풀, 645/6x6 같은 프레임은 바디가
		정하므로 따로 두지 않습니다.
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
				<col style="width: 7%" />
				<col style="width: 26%" />
				<col style="width: 18%" />
				<col style="width: 12%" />
				<col />
				<col style="width: 250px" />
			</colgroup>
			<thead>
				<tr>
					<th>종류</th>
					<th>이름</th>
					<th>고정 렌즈</th>
					<th>포맷</th>
					<th>메모</th>
					<th></th>
				</tr>
			</thead>
			<tbody>
				{#each rows as g, i (g.id)}
					<tr class:group-start={isFirst(i) && i > 0}>
						<td class="mono dim">{isFirst(i) ? label(g.kind) : ''}</td>
						<td class="wrap">{g.name}</td>
						<td class="mono wrap">{g.kind === 'camera' ? (g.fixedLens ?? '-') : ''}</td>
						<td class="mono">{g.format ?? '-'}</td>
						<td class="dim wrap">{g.notes ?? ''}</td>
						<td class="actions">
							<div class="acts">
								<form method="POST" action="?/move">
									<input type="hidden" name="id" value={g.id} /><input
										type="hidden"
										name="dir"
										value="up"
									/><button
										class="btn quiet sm"
										type="submit"
										disabled={isFirst(i)}
										aria-label="위로">▲</button
									>
								</form>
								<form method="POST" action="?/move">
									<input type="hidden" name="id" value={g.id} /><input
										type="hidden"
										name="dir"
										value="down"
									/><button
										class="btn quiet sm"
										type="submit"
										disabled={isLast(i)}
										aria-label="아래로">▼</button
									>
								</form>
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
							</div>
						</td>
					</tr>
					{#if open[g.id]}
						<tr class="editrow"><td colspan="6">{@render editForm(g)}</td></tr>
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
					<FormatSelect name="format" kind={kind === 'film' ? 'film' : 'any'} />
				{/key}
			</label>
			<label class="field wide"><span>메모</span><input type="text" name="notes" /></label>
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
	.cols .wide {
		grid-column: 1 / -1;
	}
	/* 열 너비를 고정해 메모가 비어도 여백이 멋대로 흩어지지 않고, 길면 그 칸 안에서 줄바꿈. 셀은 전부 위에 붙는다 */
	.gear {
		table-layout: fixed;
	}
	.gear td {
		vertical-align: top;
	}
	.gear td.wrap {
		white-space: normal;
		overflow-wrap: anywhere;
	}
	.gear tr.group-start td {
		border-top: 1px solid var(--color-ink-faint);
	}
	.gear td.actions {
		white-space: nowrap;
	}
	.gear .acts {
		display: flex;
		gap: 6px;
		justify-content: flex-end;
		align-items: center;
	}
	.btn.sm {
		padding: 10px 9px;
	}
	.btn.sm:disabled {
		opacity: 0.3;
		cursor: default;
	}
	.editrow td {
		background: rgba(255, 255, 255, 0.02);
	}
	.acts {
		display: flex;
		gap: 8px;
	}
</style>
