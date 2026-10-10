<script lang="ts">
	import RollForm from '#lib/components/RollForm.svelte';
	import type { PageProps } from './$types';
	let { data, form }: PageProps = $props();
	type Folder = (typeof data.folders)[number];

	const ym = (d: string | null) => (d ? d.slice(0, 7).replace('-', '.') : '-');
	const pending = $derived(data.folders.filter((f) => !f.confirmedAt));
	const confirmed = $derived(data.folders.filter((f) => f.confirmedAt));
	const bySource = (rows: Folder[]) => {
		const m = new Map<string, Folder[]>();
		for (const f of rows) {
			if (!m.has(f.sourceName)) m.set(f.sourceName, []);
			m.get(f.sourceName)!.push(f);
		}
		return [...m.entries()];
	};
	const pendingBySource = $derived(bySource(pending));
	// 확정 탭에서 '수정'으로 펼친 행
	let open = $state<Record<string, boolean>>({});
</script>

<section class="admin-page">
	<h1>필름</h1>
	<p class="mono dim">
		롤 폴더에 현상월·카메라·렌즈·필름을 줍니다. 폴더명이 <code>2509_01 Rollei35s colorplus200</code> 처럼
		시작하면 스캔 때 자동으로 읽어 '미확정'에 두고, 저장하면 '확정'으로 옮겨가며 그 폴더 사진의 날짜가
		현상월(파일명 순)로 맞춰집니다.
	</p>
	{#if form?.error}<p class="notice error">{form.error}</p>{/if}
	{#if form?.saved}<p class="notice">
			'{form.title}' 저장 → 확정 목록. {#if form.hasDate}파일 {form.applied}개의 날짜를 현상월로
				맞췄습니다.{:else}현상월이 비어 있어 날짜는 그대로 두었습니다.{/if}
		</p>{/if}
	{#if form?.all}<p class="notice">
			폴더 {form.all.folders}개, 파일 {form.all.files}개의 날짜를 현상월로 맞췄습니다.
		</p>{/if}

	<div class="bar">
		<nav class="tabs mono" aria-label="폴더 상태">
			<a href="?tab=confirmed" class:on={data.tab === 'confirmed'}
				>확정 <span class="n">{confirmed.length}</span></a
			>
			<a href="?tab=pending" class:on={data.tab === 'pending'}
				>미확정 <span class="n">{pending.length}</span></a
			>
		</nav>
		<form method="POST" action={`?/applyAll&tab=${data.tab}`}>
			<button class="btn quiet" type="submit">모든 폴더 날짜 다시 맞추기</button>
		</form>
	</div>

	{#if data.tab === 'pending'}
		{#if pending.length === 0}
			<p class="dim">
				미확정 폴더가 없습니다. {#if data.folders.length === 0}필름 라이브러리를 등록하고 스캔하면
					폴더가 나타납니다.{/if}
			</p>
		{/if}
		{#each pendingBySource as [name, rows] (name)}
			<h2>{name}</h2>
			{#each rows as f (f.id)}
				<RollForm folder={f} gear={data.gear} fixedLens={data.fixedLens} tab={data.tab} />
			{/each}
		{/each}
	{:else if confirmed.length === 0}
		<p class="dim">아직 저장한 폴더가 없습니다.</p>
	{:else}
		<table class="table confirmed">
			<thead>
				<tr>
					<th>폴더</th>
					<th>제목</th>
					<th>현상월</th>
					<th>롤</th>
					<th>카메라</th>
					<th>렌즈</th>
					<th>필름</th>
					<th>장수</th>
					<th></th>
				</tr>
			</thead>
			<tbody>
				{#each confirmed as f (f.id)}
					<tr>
						<td class="mono">{f.relDir || '(루트)'}</td>
						<td>{f.title ?? '-'}</td>
						<td class="mono">{ym(f.developedAt)}</td>
						<td class="mono">{f.rollNo ?? '-'}</td>
						<td class="mono">{f.camera ?? '-'}</td>
						<td class="mono">{f.lens ?? '-'}</td>
						<td class="mono">{f.filmStock ?? '-'}</td>
						<td class="mono dim">{f.fileCount}</td>
						<td
							><button class="btn quiet" type="button" onclick={() => (open[f.id] = !open[f.id])}
								>{open[f.id] ? '접기' : '수정'}</button
							></td
						>
					</tr>
					{#if open[f.id]}
						<tr class="editrow">
							<td colspan="9">
								<RollForm
									folder={f}
									gear={data.gear}
									fixedLens={data.fixedLens}
									tab={data.tab}
									compact
									onclose={() => (open[f.id] = false)}
								/>
							</td>
						</tr>
					{/if}
				{/each}
			</tbody>
		</table>
	{/if}
</section>

<style>
	code {
		font-family: var(--font-mono);
	}
	.bar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 16px;
		flex-wrap: wrap;
		margin: 0 0 18px;
	}
	.tabs {
		display: flex;
		gap: 4px;
		font-size: 13px;
		letter-spacing: 0.06em;
	}
	.tabs a {
		padding: 8px 14px;
		border: 1px solid var(--color-ink-faint);
		color: var(--color-ink-dim);
	}
	.tabs a.on {
		color: var(--color-amber);
		border-color: var(--color-amber);
	}
	.tabs .n {
		opacity: 0.7;
		margin-left: 4px;
	}
	.confirmed td {
		vertical-align: top;
	}
	.editrow td {
		background: rgba(255, 255, 255, 0.02);
	}
</style>
