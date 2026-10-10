<script lang="ts">
	import type { PageProps } from './$types';
	let { data, form }: PageProps = $props();
	let kind: 'manual' | 'smart' = $state('manual');
</script>

<section class="admin-page">
	<h1>컬렉션</h1>
	<p class="mono dim">
		게스트에게 보이는 큐레이션 단위. 수동은 사진 페이지에서 '컬렉션에 추가'로 넣고 순서를 정한다.
		스마트는 규칙(매체·컷·라이브러리·연도)으로 자동이며, 필름은 롤마다 시리즈로 나눌 수 있다.
	</p>
	{#if form?.error}<p class="notice error">{form.error}</p>{/if}
	{#if form?.ok}<p class="notice">{form.ok}</p>{/if}

	<h2>목록</h2>
	{#if data.collections.length === 0}<p class="dim">아직 없습니다.</p>{/if}
	{#if data.collections.length}
		<table class="table">
			<thead><tr><th>제목</th><th>종류</th><th>장수</th><th>공개</th><th></th></tr></thead>
			<tbody>
				{#each data.collections as c (c.id)}
					<tr>
						<td
							><a href={`/admin/collections/${c.id}`}>{c.title}</a>
							<div class="mono dim path">/c/{c.slug}</div></td
						>
						<td class="mono">{c.kind === 'smart' ? '스마트' : '수동'}</td>
						<td class="mono">{c.count}</td>
						<td class="mono">{c.visibility === 'public' ? '공개' : '숨김'}</td>
						<td class="acts">
							<a class="btn quiet" href={`/c/${c.slug}`}>보기</a>
							<form
								method="POST"
								action="?/delete"
								onsubmit={(e) => {
									if (!confirm(`'${c.title}' 컬렉션을 삭제할까요? 사진은 그대로 둡니다.`))
										e.preventDefault();
								}}
							>
								<input type="hidden" name="id" value={c.id} /><button
									class="btn danger"
									type="submit">삭제</button
								>
							</form>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}

	<h2>새 컬렉션</h2>
	<form method="POST" action="?/create" class="create">
		<label class="field"><span>제목</span><input type="text" name="title" required /></label>
		<label class="field"
			><span>서문 (마크다운, 선택)</span><input type="text" name="statement" /></label
		>
		<div class="cols">
			<label class="field"
				><span>종류</span>
				<select name="kind" bind:value={kind}>
					<option value="manual">수동 (직접 고름)</option>
					<option value="smart">스마트 (규칙)</option>
				</select>
			</label>
			<label class="field"
				><span>정렬</span>
				<select name="sort">
					{#if kind === 'manual'}<option value="manual">수동 순서</option>{/if}
					<option value="taken_asc">촬영순 (오래된 것부터)</option>
					<option value="taken_desc">최신순</option>
				</select>
			</label>
			<label class="field"
				><span>공개</span>
				<select name="visibility"
					><option value="public">공개</option><option value="hidden">숨김</option></select
				>
			</label>
		</div>
		{#if kind === 'smart'}
			<div class="cols rule">
				<label class="field"
					><span>매체</span>
					<select name="medium"
						><option value="">전부</option><option value="film">필름</option><option value="digital"
							>디지털</option
						></select
					>
				</label>
				<label class="field"
					><span>컷</span>
					<select name="tier"
						><option value="">전부</option><option value="A">A컷만</option><option value="B"
							>B컷만</option
						></select
					>
				</label>
				<label class="field"
					><span>라이브러리</span>
					<select name="sourceId"
						><option value="">전부</option>{#each data.sources as s (s.id)}<option value={s.id}
								>{s.name}</option
							>{/each}</select
					>
				</label>
				<label class="field"
					><span>연도</span><input
						type="text"
						name="year"
						inputmode="numeric"
						placeholder="예: 2025"
					/></label
				>
			</div>
			<label class="check mono"
				><input type="checkbox" name="seriesByFolder" checked /> 폴더(롤)마다 시리즈로 나누기</label
			>
		{/if}
		<button class="btn primary" type="submit">만들기</button>
	</form>
</section>

<style>
	.path {
		font-size: 12px;
		margin-top: 2px;
	}
	.acts {
		display: flex;
		gap: 6px;
		white-space: nowrap;
	}
	.create {
		max-width: 760px;
	}
	.cols {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
		gap: 0 16px;
	}
	.rule {
		border-left: 2px solid var(--color-ink-faint);
		padding-left: 14px;
	}
	.check {
		display: flex;
		gap: 8px;
		align-items: center;
		font-size: 12px;
		margin: 4px 0 20px;
		color: var(--color-ink-dim);
	}
</style>
