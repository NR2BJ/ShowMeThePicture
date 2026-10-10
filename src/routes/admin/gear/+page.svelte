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
	// 한 표에 종류 순(카메라 → 렌즈 → 필름), 종류 안에서는 position 순. 끌어서 바꾸면 바로 저장한다
	// svelte-ignore state_referenced_locally
	let rows = $state<Gear[]>(data.gear);
	$effect(() => {
		rows = data.gear;
	});
	const isFirst = (i: number) => i === 0 || rows[i - 1].kind !== rows[i].kind;
	let dragId = $state<string | null>(null);
	let reorderError = $state<string | null>(null);
	function dragStart(e: DragEvent, g: Gear) {
		dragId = g.id;
		e.dataTransfer?.setData('text/plain', g.id);
		if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
	}
	/** 같은 종류 위로 끌고 가면 그 자리로 옮긴다 (미리 보이게) */
	function dragOver(e: DragEvent, over: Gear) {
		if (!dragId || dragId === over.id) return;
		const from = rows.findIndex((r) => r.id === dragId);
		const to = rows.findIndex((r) => r.id === over.id);
		if (from < 0 || to < 0 || rows[from].kind !== over.kind) return;
		e.preventDefault();
		const next = rows.slice();
		const [moved] = next.splice(from, 1);
		next.splice(to, 0, moved);
		rows = next;
	}
	async function dragEnd() {
		if (!dragId) return;
		const kind = rows.find((r) => r.id === dragId)?.kind;
		dragId = null;
		if (!kind) return;
		const ids = rows.filter((r) => r.kind === kind).map((r) => r.id);
		try {
			const r = await fetch('/api/admin/gear', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ ids })
			});
			if (!r.ok) throw new Error(`HTTP ${r.status}`);
			reorderError = null;
		} catch (err) {
			reorderError = `순서를 저장하지 못했습니다 (${err instanceof Error ? err.message : String(err)})`;
			rows = data.gear;
		}
	}
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
	{#if form?.error}<p class="notice error">{form.error}</p>{/if}
	{#if form?.ok}<p class="notice">{form.ok}</p>{/if}
	{#if reorderError}<p class="notice error">{reorderError}</p>{/if}

	<h2>등록된 장비</h2>
	{#if rows.length === 0}
		<p class="dim">없음</p>
	{:else}
		<table class="table gear">
			<colgroup>
				<col style="width: 7%" />
				<col style="width: 36px" />
				<col style="width: 25%" />
				<col style="width: 18%" />
				<col style="width: 12%" />
				<col />
				<col style="width: 170px" />
			</colgroup>
			<thead>
				<tr>
					<th>종류</th>
					<th></th>
					<th>이름</th>
					<th>고정 렌즈</th>
					<th>포맷</th>
					<th>메모</th>
					<th></th>
				</tr>
			</thead>
			<tbody>
				{#each rows as g, i (g.id)}
					<tr
						class:group-start={isFirst(i) && i > 0}
						class:dragging={dragId === g.id}
						draggable="true"
						ondragstart={(e) => dragStart(e, g)}
						ondragover={(e) => dragOver(e, g)}
						ondragend={dragEnd}
					>
						<td class="mono dim">{isFirst(i) ? label(g.kind) : ''}</td>
						<td class="handle" title="끌어서 순서 바꾸기"><span aria-hidden="true">≡</span></td>
						<td class="wrap">{g.name}</td>
						<td class="mono wrap">{g.kind === 'camera' ? (g.fixedLens ?? '-') : ''}</td>
						<td class="mono">{g.format ?? '-'}</td>
						<td class="dim wrap">{g.notes ?? ''}</td>
						<td class="actions">
							<div class="acts">
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
	.handle {
		cursor: grab;
		color: var(--color-ink-dim);
		font-size: 22px;
		line-height: 1;
		user-select: none;
		text-align: center;
	}
	tr.dragging {
		opacity: 0.4;
	}
	.editrow td {
		background: rgba(255, 255, 255, 0.02);
	}
	.acts {
		display: flex;
		gap: 8px;
	}
</style>
