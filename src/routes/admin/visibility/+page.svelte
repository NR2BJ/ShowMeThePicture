<script lang="ts">
	import { enhance } from '$app/forms';
	import { stackTable } from '#lib/actions/stackTable.ts';
	import type { PageProps } from './$types';
	let { data, form }: PageProps = $props();
	const vis = (v: 'public' | 'hidden') => (v === 'public' ? '공개' : '숨김');
	const cut = (t: 'A' | 'B' | null) => (t ? `${t}컷` : '없음');
	const turn = (n: 1 | 2 | 3) => (n === 1 ? '90° 오른쪽' : n === 2 ? '180°' : '90° 왼쪽');
	const day = (iso: string | null) => (iso ? iso.slice(0, 10).replaceAll('-', '.') : '날짜 없음');

	// 필터: 무엇이 바뀌었는지(여러 개 고르면 그중 하나라도) · 라이브러리. 아무것도 안 고르면 전부.
	type What = 'vis' | 'tier' | 'rot';
	const WHATS: [What, string][] = [
		['vis', '공개 바뀜'],
		['tier', '컷 바뀜'],
		['rot', '방향 바뀜']
	];
	const has = (o: (typeof data.overrides)[number], w: What) =>
		w === 'vis' ? o.visibilityManual : w === 'tier' ? o.tierManual : o.rotations.length > 0;
	let whats = $state<What[]>([]);
	let source = $state('');
	const sources = $derived([...new Set(data.overrides.map((o) => o.source))].sort());
	const shown = $derived(
		data.overrides.filter(
			(o) =>
				(whats.length === 0 || whats.some((w) => has(o, w))) && (!source || o.source === source)
		)
	);
	const toggle = (w: What) =>
		(whats = whats.includes(w) ? whats.filter((x) => x !== w) : [...whats, w]);
</script>

<!-- 공개 여부나 컷이 폴더 기본값(자동 컷)과 다르거나, 방향을 저장한 파일이 있는 사진만 나온다. 기본값과 같아지면 빠진다. -->
<section class="admin-page">
	<h1>직접 바꾼 사진</h1>
	{#if form?.error}<p class="notice error">{form.error}</p>{/if}
	{#if form?.ok}<p class="notice">{form.ok}</p>{/if}
	{#if data.overrides.length === 0}
		<p class="dim">아직 없습니다.</p>
	{:else}
		<div class="filters mono">
			{#each WHATS as [w, label] (w)}
				{@const n = data.overrides.filter((o) => has(o, w)).length}
				{#if n > 0}
					<button
						type="button"
						class="chip"
						class:on={whats.includes(w)}
						aria-pressed={whats.includes(w)}
						onclick={() => toggle(w)}>{label} <span class="n">{n}</span></button
					>
				{/if}
			{/each}
			{#if sources.length > 1}
				<label class="pick"
					><span>라이브러리</span>
					<select bind:value={source}>
						<option value="">전체</option>
						{#each sources as s (s)}<option value={s}>{s}</option>{/each}
					</select></label
				>
			{/if}
			<span class="dim count">{shown.length}장 · 찍은 날짜순</span>
		</div>
		<table class="table overrides stack" use:stackTable>
			<thead
				><tr
					><th></th><th>파일</th><th>라이브러리</th><th>공개 · 기본값</th><th>컷 · 자동</th><th
						>방향</th
					></tr
				></thead
			>
			<tbody>
				{#each shown as o (o.id)}
					<tr>
						<td class="thumb"
							><a href={`/p/${o.id}?ctx=manual`}><img src={o.thumb} alt="" class="th" /></a></td
						>
						<td class="mono lead">{o.filename}<span class="dim day">{day(o.takenAt)}</span></td>
						<td class="mono dim">{o.source}</td>
						<td>
							<div class="cell">
								<span class="mono" class:on={o.visibility === 'public'}>{vis(o.visibility)}</span>
								{#if o.visibilityManual}
									<span class="mono dim">· 기본 {vis(o.defaultVisibility)}</span>
									<form method="POST" action="?/reset" use:enhance>
										<input type="hidden" name="photoId" value={o.id} /><button
											class="btn quiet"
											type="submit">기본값으로</button
										>
									</form>
								{:else}<span class="mono dim">· 기본값</span>{/if}
							</div>
						</td>
						<td>
							<div class="cell">
								<span class="mono" class:on={!!o.tier}>{cut(o.tier)}</span>
								{#if o.tierManual}
									<span class="mono dim">· 자동 {cut(o.defaultTier)}</span>
									<form method="POST" action="?/resetTier" use:enhance>
										<input type="hidden" name="photoId" value={o.id} /><button
											class="btn quiet"
											type="submit">자동으로</button
										>
									</form>
								{:else}<span class="mono dim">· 자동</span>{/if}
							</div>
						</td>
						<td>
							<div class="cell">
								{#if o.rotations.length}
									<span class="mono"
										>{o.rotations.map((r) => `${r.name} ${turn(r.turns)}`).join(' · ')}</span
									>
									<form method="POST" action="?/resetRotation" use:enhance>
										<input type="hidden" name="photoId" value={o.id} /><button
											class="btn quiet"
											type="submit">원래대로</button
										>
									</form>
								{:else}<span class="mono dim">원래대로</span>{/if}
							</div>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</section>

<style>
	/* 버튼이 있는 칸과 없는 칸 모두 상하 가운데 */
	.overrides :global(td) {
		vertical-align: middle;
	}
	/* 썸네일 칸은 폭 고정 — 다른 칸이 줄바꿈 없이 자리를 차지하면 이미지(max-width:100%)가 거의 0 으로 줄어 안 보였다 */
	.thumb {
		width: 96px;
	}
	.th {
		display: block;
		width: 96px;
		max-width: none;
		height: 64px;
		object-fit: cover;
		background: #000;
	}
	.on {
		color: var(--color-amber);
	}
	.day {
		display: block;
		font-size: 14px;
		margin-top: 2px;
	}
	.filters {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px 14px;
		margin: 0 0 20px;
		font-size: 15px;
	}
	.chip {
		font: inherit;
		color: var(--color-ink-dim);
		background: transparent;
		border: 1px solid var(--color-ink-faint);
		padding: 5px 10px;
		cursor: pointer;
	}
	.chip.on {
		color: var(--color-amber);
		border-color: var(--color-amber);
	}
	.n {
		color: var(--color-ink-faint);
		margin-left: 2px;
	}
	.pick {
		display: flex;
		align-items: center;
		gap: 8px;
		color: var(--color-ink-dim);
	}
	.pick select {
		font: inherit;
		color: var(--color-ink);
		background: var(--color-bg);
		border: 1px solid var(--color-ink-faint);
		padding: 5px 8px;
	}
	.count {
		margin-left: auto;
	}
	.cell {
		display: flex;
		align-items: center;
		gap: 8px;
		min-height: 48px;
		white-space: nowrap;
	}
	/* 폰·태블릿: 카드로 쌓이면 값과 버튼이 한 줄에 안 들어갈 수 있다 — 감싸서 넘치지 않게 */
	@media (max-width: 1024px) {
		.cell {
			flex-wrap: wrap;
			min-height: 0;
			white-space: normal;
		}
		.count {
			margin-left: 0;
			flex-basis: 100%;
		}
	}
</style>
