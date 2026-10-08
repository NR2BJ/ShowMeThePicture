<script lang="ts">
	import type { PageProps } from './$types';
	let { data }: PageProps = $props();
	const totals = $derived({
		files: data.sources.reduce((a, s) => a + s.fileCount, 0),
		indexed: data.sources.reduce((a, s) => a + s.indexedCount, 0),
		missing: data.sources.reduce((a, s) => a + s.missingCount, 0)
	});
</script>

<section class="admin-page">
	<h1>대시보드</h1>

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
