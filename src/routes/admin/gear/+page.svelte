<script lang="ts">
	import { stackTable } from '#lib/actions/stackTable.ts';
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
	// 순서 바꾸기: 손잡이(≡)를 잡고 위아래로 끈다. 마우스·손가락 모두 포인터 이벤트로 — HTML 기본 드래그는 폰에서 안 되고,
	// '지금 올라가 있는 행' 기준이라 빨리 끌어 그룹 끝을 지나치면 끝에서 두 번째에 멈췄다.
	// 이제는 포인터 높이를 같은 종류 행들의 가운데선과 비교해 자리를 정한다(끝을 지나치면 맨 끝).
	let dragId = $state<string | null>(null);
	let reorderError = $state<string | null>(null);
	let tbody: HTMLTableSectionElement | undefined = $state();
	let startOrder = '';
	let lastY = 0;
	let raf = 0;
	const groupIds = (k: string) => rows.filter((r) => r.kind === k).map((r) => r.id);
	function place(y: number) {
		const me = rows.find((r) => r.id === dragId);
		if (!me || !tbody) return;
		const others = [
			...tbody.querySelectorAll<HTMLTableRowElement>(`tr[data-kind="${me.kind}"]`)
		].filter((tr) => tr.dataset.id !== me.id);
		let at = 0;
		for (const tr of others) {
			const r = tr.getBoundingClientRect();
			if (r.top + r.height / 2 < y) at++;
		}
		const ids = others.map((tr) => tr.dataset.id as string);
		ids.splice(at, 0, me.id);
		if (ids.join() === groupIds(me.kind).join()) return;
		const byId = new Map(rows.map((r) => [r.id, r]));
		const out: Gear[] = [];
		let placed = false;
		for (const r of rows) {
			if (r.kind !== me.kind) out.push(r);
			else if (!placed) {
				out.push(...ids.map((id) => byId.get(id) as Gear));
				placed = true;
			}
		}
		rows = out;
	}
	// 화면 위·아래 가장자리 근처에서 잡고 있으면 페이지를 천천히 굴린다 (폰에서 긴 목록 끝까지)
	function autoScroll() {
		if (!dragId) return;
		const edge = 80;
		const dy =
			lastY < edge
				? -Math.ceil((edge - lastY) / 5)
				: lastY > innerHeight - edge
					? Math.ceil((lastY - (innerHeight - edge)) / 5)
					: 0;
		if (dy) {
			window.scrollBy(0, dy);
			place(lastY);
		}
		raf = requestAnimationFrame(autoScroll);
	}
	function onMove(e: PointerEvent) {
		lastY = e.clientY;
		place(lastY);
	}
	function grab(e: PointerEvent, g: Gear) {
		if (e.button !== 0) return;
		e.preventDefault();
		dragId = g.id;
		lastY = e.clientY;
		startOrder = groupIds(g.kind).join();
		// 행이 DOM 에서 자리를 옮겨도 놓치지 않게 창에서 받는다 (요소에 붙인 포인터 캡처는 그때 풀린다)
		window.addEventListener('pointermove', onMove);
		window.addEventListener('pointerup', drop);
		window.addEventListener('pointercancel', drop);
		raf = requestAnimationFrame(autoScroll);
	}
	async function drop() {
		window.removeEventListener('pointermove', onMove);
		window.removeEventListener('pointerup', drop);
		window.removeEventListener('pointercancel', drop);
		cancelAnimationFrame(raf);
		const kind = rows.find((r) => r.id === dragId)?.kind;
		dragId = null;
		if (!kind) return;
		const ids = groupIds(kind);
		if (ids.join() === startOrder) return;
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
		<table class="table gear stack" use:stackTable>
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
			<tbody bind:this={tbody}>
				{#each rows as g, i (g.id)}
					<!-- 폰·태블릿 카드 보기에서만 보이는 종류 제목 줄 (컴퓨터는 왼쪽 '종류' 칸이 그 역할) -->
					{#if isFirst(i)}<tr class="group-head"><td colspan="7">{label(g.kind)}</td></tr>{/if}
					<tr
						data-id={g.id}
						data-kind={g.kind}
						class:group-start={isFirst(i) && i > 0}
						class:dragging={dragId === g.id}
					>
						<td class="mono dim kind">{isFirst(i) ? label(g.kind) : ''}</td>
						<td class="handle bare"
							><button
								type="button"
								class="grip"
								title="끌어서 순서 바꾸기 (같은 종류 안에서)"
								aria-label={`${g.name} 순서 바꾸기`}
								onpointerdown={(e) => grab(e, g)}>≡</button
							></td
						>
						<td class="wrap lead">{g.name}</td>
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
						? '예: ColorPlus 200'
						: kind === 'lens'
							? '예: Nikkor 50mm'
							: '예: Rollei 35S'}
				/></label
			>
			{#if kind === 'camera'}
				<label class="field"
					><span>고정 렌즈 (있으면)</span><input
						type="text"
						name="fixedLens"
						placeholder="예: Sonnar 40mm"
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
	/* 열 너비를 고정해 메모가 비어도 여백이 멋대로 흩어지지 않고, 길면 그 칸 안에서 줄바꿈 */
	.gear {
		table-layout: fixed;
	}
	.gear tr.group-head {
		display: none;
	}
	/* 폰·태블릿: 카드로 쌓는다(app.css .table.stack). 종류는 그룹 제목 줄로, 손잡이는 카드 오른쪽 위 */
	@media (max-width: 1024px) {
		.gear {
			table-layout: auto;
		}
		.gear tbody tr {
			position: relative;
		}
		.gear tbody tr.group-head {
			display: block;
			padding: 28px 0 8px;
			border-bottom: 1px solid var(--color-amber);
		}
		.gear tbody tr.group-head:first-child {
			padding-top: 0;
		}
		.gear tr.group-head td {
			font-family: var(--font-mono);
			font-size: 14px;
			letter-spacing: 0.16em;
			color: var(--color-amber);
		}
		.gear td.kind {
			display: none;
		}
		.gear td.lead {
			padding-right: 52px;
		}
		.gear td.handle {
			position: absolute;
			top: 6px;
			right: 0;
			padding: 0;
		}
		.gear .grip {
			width: 44px;
			height: 44px;
		}
		.gear tbody tr.group-start td {
			border-top: 0;
		}
		.gear td .acts {
			justify-content: flex-start;
		}
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
		text-align: center;
		padding: 0;
	}
	.grip {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		/* 칸 전체가 손잡이 — 작은 ≡ 글자만 잡히면 빗나가기 쉽다 */
		width: 100%;
		min-width: 32px;
		height: 40px;
		font-size: 22px;
		line-height: 1;
		color: var(--color-ink-dim);
		background: none;
		border: 0;
		cursor: grab;
		user-select: none;
		/* 손가락으로 잡았을 때 페이지가 스크롤되지 않고 끌리게 */
		touch-action: none;
	}
	.grip:hover {
		color: var(--color-ink);
	}
	tr.dragging {
		background: rgba(217, 166, 90, 0.08);
	}
	tr.dragging .grip {
		color: var(--color-amber);
		cursor: grabbing;
	}
	.editrow td {
		background: rgba(255, 255, 255, 0.02);
	}
	.acts {
		display: flex;
		gap: 8px;
	}
</style>
