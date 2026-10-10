<script lang="ts">
	import { autoRefresh } from '#lib/actions/autoRefresh.ts';
	import type { PageProps } from './$types';
	let { data }: PageProps = $props();
	const busy = $derived(
		data.sources.some((s) => s.pendingCount > 0) ||
			data.queues.some((q) => q.state === 'active' || q.state === 'created')
	);
	const sm = $derived(data.summary);
	const totals = $derived({
		files: data.sources.reduce((a, s) => a + s.fileCount, 0),
		indexed: data.sources.reduce((a, s) => a + s.indexedCount, 0),
		missing: data.sources.reduce((a, s) => a + s.missingCount, 0),
		pending: data.sources.reduce((a, s) => a + s.pendingCount, 0),
		failed: data.sources.reduce((a, s) => a + s.failedCount, 0)
	});
</script>

<section class="admin-page" use:autoRefresh={busy ? 4000 : 20000}>
	<h1>
		대시보드 <span class="mono dim live">{busy ? '처리 중 · 4초마다 갱신' : '20초마다 갱신'}</span>
	</h1>

	<div class="cards">
		<a class="card" href="/admin/sources">
			<span class="k mono">라이브러리</span>
			<span class="v">{data.sources.length}<small>폴더</small></span>
			<span class="s mono dim"
				>파일 {totals.files} · 처리 {totals.indexed}{#if totals.pending}
					· 대기 {totals.pending}{/if}{#if totals.failed}
					· <b class="bad">실패 {totals.failed}</b>{/if}{#if totals.missing}
					· 없어짐 {totals.missing}{/if}</span
			>
		</a>
		<a class="card" href="/admin/visibility">
			<span class="k mono">사진</span>
			<span class="v">{sm.photos.total}<small>장</small></span>
			<span class="s mono dim"
				>공개 {sm.photos.pub} · 숨김 {sm.photos.hidden}{#if sm.photos.manual}
					· 수동 {sm.photos.manual}{/if}<br />A컷 {sm.photos.a} · B컷 {sm.photos.b} · 원본만 {sm
					.photos.original}</span
			>
		</a>
		<a class="card" href="/admin/pairs" class:attn={sm.pairs.review > 0}>
			<span class="k mono">페어링</span>
			<span class="v">{sm.pairs.review}<small>검토 필요</small></span>
			<span class="s mono dim"
				>미확정 {sm.pairs.auto} · 확정 {sm.pairs.confirmed} · 원본 없음 {sm.pairs.unpaired}</span
			>
		</a>
		<a class="card" href="/admin/folders?tab=pending" class:attn={sm.folders.pending > 0}>
			<span class="k mono">폴더 정보</span>
			<span class="v">{sm.folders.pending}<small>미확정</small></span>
			<span class="s mono dim">확정 {sm.folders.confirmed}</span>
		</a>
		<a class="card" href="/admin/gear">
			<span class="k mono">장비</span>
			<span class="v">{sm.gear.camera + sm.gear.lens + sm.gear.film}<small>개</small></span>
			<span class="s mono dim"
				>카메라 {sm.gear.camera} · 렌즈 {sm.gear.lens} · 필름 {sm.gear.film}</span
			>
		</a>
		<a class="card" href="/admin/collections">
			<span class="k mono">컬렉션</span>
			<span class="v">{sm.collections.total}<small>개</small></span>
			<span class="s mono dim">공개 {sm.collections.pub}</span>
		</a>
	</div>

	<h2>라이브러리</h2>
	{#if data.sources.length === 0}
		<p class="notice">
			등록된 폴더가 없습니다. <a href="/admin/sources">라이브러리</a>에서 폴더를 추가하세요.
		</p>
	{:else}
		<table class="table">
			<thead
				><tr
					><th>이름</th><th>역할</th><th>파일</th><th>처리됨</th><th>없어짐</th><th>마지막 스캔</th
					></tr
				></thead
			>
			<tbody>
				{#each data.sources as s (s.id)}
					<tr>
						<td
							><a href={`/library/${s.slug}`}>{s.name}</a>
							<div class="mono dim">{s.rootPath}</div></td
						>
						<td class="mono"
							>{s.role}{s.medium ? ` · ${s.medium}` : ''}{s.tier ? ` · ${s.tier}컷` : ''}</td
						>
						<td class="mono">{s.fileCount}</td>
						<td class="mono">{s.indexedCount}</td>
						<td class="mono">{s.pendingCount}</td>
						<td class="mono" class:bad={s.failedCount > 0}>{s.failedCount}</td>
						<td class="mono">{s.missingCount}</td>
						<td class="mono dim"
							>{s.lastScannedAt ? new Date(s.lastScannedAt).toLocaleString('ko-KR') : '-'}</td
						>
					</tr>
				{/each}
				<tr
					><td class="mono dim">합계</td><td></td><td class="mono">{totals.files}</td><td
						class="mono">{totals.indexed}</td
					><td class="mono">{totals.missing}</td><td></td></tr
				>
			</tbody>
		</table>
	{/if}

	{#if data.failures.length}
		<h2>처리 실패 (최근 {data.failures.length})</h2>
		<table class="table">
			<thead><tr><th>파일</th><th>라이브러리</th><th>사유</th></tr></thead>
			<tbody>
				{#each data.failures as f (f.id)}
					<tr
						><td class="mono">{f.relPath}</td><td class="mono dim">{f.source}</td><td
							class="mono bad">{f.error}</td
						></tr
					>
				{/each}
			</tbody>
		</table>
		<p class="mono dim">
			원인을 고친 뒤 라이브러리에서 '지금 스캔'을 누르면 실패한 파일을 다시 처리합니다.
		</p>
	{/if}

	<h2>캐시</h2>
	<p class="mono">
		{data.cache.total} · 파일 {data.cache.files}
		{#if data.cache.bySize.thumb}<span class="dim"> · thumb {data.cache.bySize.thumb}</span>{/if}
		{#if data.cache.bySize.preview}<span class="dim">
				· preview {data.cache.bySize.preview}</span
			>{/if}
		{#if data.cache.bySize.full}<span class="dim"> · full {data.cache.bySize.full}</span>{/if}
	</p>
	<p class="mono dim">
		{data.cache.dir} · thumb/preview 는 스캔 때 생성, full 은 사진을 열 때 생성됩니다. 10분마다 다시 잽니다.
	</p>

	<h2>잡 큐</h2>
	{#if data.queues.length === 0}
		<p class="dim">큐가 비어 있거나 워커가 아직 돌지 않았습니다.</p>
	{:else}
		<table class="table">
			<thead><tr><th>큐</th><th>상태</th><th>개수</th></tr></thead>
			<tbody>
				{#each data.queues as q (q.name + q.state)}
					<tr
						><td class="mono">{q.name}</td><td class="mono">{q.state}</td><td class="mono"
							>{q.count}</td
						></tr
					>
				{/each}
			</tbody>
		</table>
	{/if}
</section>

<style>
	.cards {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
		gap: 10px;
		margin: 0 0 28px;
	}
	.card {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 14px 16px;
		border: 1px solid var(--color-ink-faint);
		color: inherit;
	}
	.card:hover {
		border-color: var(--color-amber);
	}
	.card.attn {
		border-color: var(--color-amber);
	}
	.card .k {
		font-size: 11px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--color-ink-dim);
	}
	.card .v {
		font-family: var(--font-serif);
		font-size: 34px;
		line-height: 1;
	}
	.card .v small {
		font-family: var(--font-mono);
		font-size: 12px;
		margin-left: 8px;
		color: var(--color-ink-dim);
	}
	.card .s {
		font-size: 12px;
		line-height: 1.5;
	}
	.bad {
		color: #d98a7a;
	}
	.live {
		font-size: 11px;
		letter-spacing: 0.08em;
		margin-left: 12px;
		vertical-align: middle;
	}
</style>
