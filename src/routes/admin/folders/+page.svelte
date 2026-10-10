<script lang="ts">
	import FormatSelect from '#lib/components/FormatSelect.svelte';
	import GearSelect from '#lib/components/GearSelect.svelte';
	import type { PageProps } from './$types';
	let { data, form }: PageProps = $props();
	type Folder = (typeof data.folders)[number];

	const month = (d: string | null) => (d ? d.slice(0, 7) : '');
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

{#snippet rollForm(f: Folder, compact: boolean)}
	<form method="POST" action={`?/save&tab=${data.tab}`} class="roll" class:compact>
		<input type="hidden" name="id" value={f.id} />
		{#if !compact}
			<div class="head">
				<span class="mono">{f.relDir || '(루트)'}</span>
				<span class="mono dim">{f.fileCount}장</span>
			</div>
		{/if}
		<div class="grid">
			<label class="field"
				><span>제목</span><input type="text" name="title" value={f.title ?? ''} /></label
			>
			<label class="field"
				><span>현상월</span><input
					type="month"
					name="developedAt"
					value={month(f.developedAt)}
				/></label
			>
			<label class="field"
				><span>롤 번호</span><input
					type="text"
					name="rollNo"
					inputmode="numeric"
					value={f.rollNo ?? ''}
				/></label
			>
			<label class="field"
				><span>카메라</span><GearSelect
					name="camera"
					value={f.camera}
					options={data.gear.camera}
				/></label
			>
			<label class="field"
				><span>렌즈</span><GearSelect name="lens" value={f.lens} options={data.gear.lens} /></label
			>
			<label class="field"
				><span>필름</span><GearSelect
					name="filmStock"
					value={f.filmStock}
					options={data.gear.film}
				/></label
			>
			<div class="field">
				<span>포맷</span>
				<FormatSelect
					name="filmFormat"
					value={f.filmFormat}
					kind="film"
					recent={data.recentFormats}
				/>
			</div>
			<label class="field"
				><span>스캐너</span><input type="text" name="scanner" value={f.scanner ?? ''} /></label
			>
			<label class="field wide"
				><span>메모</span><input type="text" name="notes" value={f.notes ?? ''} /></label
			>
		</div>
		<div class="acts">
			<button class="btn" type="submit">저장하고 날짜 맞추기</button>
			{#if compact}
				<button class="btn quiet" type="button" onclick={() => (open[f.id] = false)}>닫기</button>
			{/if}
		</div>
	</form>
{/snippet}

<section class="admin-page">
	<h1>폴더 정보</h1>
	<p class="mono dim">
		필름 롤처럼 EXIF 가 없는 폴더에 현상월·카메라·렌즈·필름을 준다. 폴더명이 <code
			>2509_01 Rollei35s colorplus200</code
		>
		처럼 현상월_롤번호로 시작하면 스캔 때 날짜·롤 번호를 읽고,
		<a href="/admin/gear">장비</a>에 등록된 이름이 폴더명에 있으면 카메라·렌즈·필름도 자동으로
		채워진다. 자동으로 읽은 폴더는 '미확정'에 있고, 한 번 저장하면 '확정'으로 옮겨가 한 줄로 보인다.
		저장하면 그 폴더 안 파일의 날짜가 현상월(파일명 순)로 맞춰진다 — 스캐너가 EXIF 에 넣은 스캔
		날짜도 덮어쓴다.
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
			<a href="?tab=pending" class:on={data.tab === 'pending'}
				>미확정 <span class="n">{pending.length}</span></a
			>
			<a href="?tab=confirmed" class:on={data.tab === 'confirmed'}
				>확정 <span class="n">{confirmed.length}</span></a
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
				{@render rollForm(f, false)}
			{/each}
		{/each}
	{:else if confirmed.length === 0}
		<p class="dim">아직 저장한 폴더가 없습니다.</p>
	{:else}
		<table class="table confirmed">
			<thead>
				<tr>
					<th>라이브러리 · 폴더</th>
					<th>제목</th>
					<th>현상월</th>
					<th>롤</th>
					<th>카메라</th>
					<th>렌즈</th>
					<th>필름</th>
					<th>포맷</th>
					<th>장수</th>
					<th></th>
				</tr>
			</thead>
			<tbody>
				{#each confirmed as f (f.id)}
					<tr>
						<td
							><span class="dim">{f.sourceName}</span>
							<div class="mono">{f.relDir || '(루트)'}</div></td
						>
						<td>{f.title ?? '-'}</td>
						<td class="mono">{ym(f.developedAt)}</td>
						<td class="mono">{f.rollNo ?? '-'}</td>
						<td class="mono">{f.camera ?? '-'}</td>
						<td class="mono">{f.lens ?? '-'}</td>
						<td class="mono">{f.filmStock ?? '-'}</td>
						<td class="mono">{f.filmFormat ?? '-'}</td>
						<td class="mono dim">{f.fileCount}</td>
						<td
							><button class="btn quiet" type="button" onclick={() => (open[f.id] = !open[f.id])}
								>{open[f.id] ? '접기' : '수정'}</button
							></td
						>
					</tr>
					{#if open[f.id]}
						<tr class="editrow">
							<td colspan="10">{@render rollForm(f, true)}</td>
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
	.roll {
		border: 1px solid var(--color-ink-faint);
		border-radius: 2px;
		padding: 14px 16px 16px;
		margin: 0 0 14px;
	}
	.roll.compact {
		border: 0;
		padding: 6px 0 10px;
		margin: 0;
	}
	.head {
		display: flex;
		justify-content: space-between;
		margin: 0 0 12px;
		font-size: 13px;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
		gap: 0 14px;
	}
	.grid .field {
		margin-bottom: 12px;
	}
	.grid .wide {
		grid-column: 1 / -1;
	}
	.grid input[type='month'] {
		background: #141311;
		border: 1px solid var(--color-ink-faint);
		color: var(--color-ink);
		padding: 11px 13px;
		font: inherit;
		border-radius: 2px;
		color-scheme: dark;
	}
	.acts {
		display: flex;
		gap: 8px;
	}
	.confirmed td {
		vertical-align: top;
	}
	.editrow td {
		background: rgba(255, 255, 255, 0.02);
	}
</style>
