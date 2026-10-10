<script lang="ts">
	import type { PageProps } from './$types';
	let { data, form }: PageProps = $props();
	const c = $derived(data.c);
	const ruleText = $derived.by(() => {
		const r = c.rule;
		if (!r) return '';
		const parts = [];
		if (r.medium) parts.push(r.medium === 'film' ? '필름' : '디지털');
		if (r.tier && r.tier !== 'any') parts.push(`${r.tier}컷`);
		if (r.year) parts.push(`${r.year}년`);
		if (r.sourceId) parts.push('라이브러리 지정');
		if (r.seriesByFolder) parts.push('롤별 시리즈');
		return parts.join(' · ') || '전부';
	});
</script>

<section class="admin-page">
	<p class="mono dim">
		<a href="/admin/collections">← 컬렉션</a> · <a href={`/c/${c.slug}`}>/c/{c.slug}</a>
	</p>
	<h1>{c.title}</h1>
	{#if form?.error}<p class="notice error">{form.error}</p>{/if}
	{#if form?.ok}<p class="notice">{form.ok}</p>{/if}

	<form method="POST" action="?/save" class="edit">
		<label class="field"
			><span>제목</span><input type="text" name="title" value={c.title} required /></label
		>
		<label class="field"
			><span>서문 (마크다운)</span><input
				type="text"
				name="statement"
				value={c.statementMd ?? ''}
			/></label
		>
		<div class="cols">
			<label class="field"
				><span>정렬</span>
				<select name="sort">
					{#if c.kind === 'manual'}<option value="manual" selected={c.sort === 'manual'}
							>수동 순서</option
						>{/if}
					<option value="taken_asc" selected={c.sort === 'taken_asc'}>촬영순</option>
					<option value="taken_desc" selected={c.sort === 'taken_desc'}>최신순</option>
				</select>
			</label>
			<label class="field"
				><span>공개</span>
				<select name="visibility"
					><option value="public" selected={c.visibility === 'public'}>공개</option><option
						value="hidden"
						selected={c.visibility === 'hidden'}>숨김</option
					></select
				>
			</label>
		</div>
		<button class="btn primary" type="submit">저장</button>
		{#if c.kind === 'smart'}
			<span class="mono dim rule">규칙: {ruleText}</span>
		{/if}
	</form>
	{#if c.kind === 'smart'}
		<form method="POST" action="?/rebuild" class="inline">
			<button class="btn quiet" type="submit">규칙 다시 계산</button>
		</form>
	{/if}

	<h2>
		사진 {c.items.length}장{#if c.series.length}
			· 시리즈 {c.series.length}{/if}
	</h2>
	{#if c.kind === 'manual' && c.items.length === 0}
		<p class="dim">사진 페이지의 '컬렉션에 추가'로 넣습니다.</p>
	{/if}
	<div class="grid">
		{#each c.items as it, i (it.id)}
			<div class="cell" class:cover={c.coverPhotoId === it.id}>
				<a href={`/p/${it.id}?ctx=c:${c.slug}`}><img src={it.thumb} alt="" loading="lazy" /></a>
				<div class="acts mono">
					{#if c.kind === 'manual' && c.sort === 'manual'}
						<form method="POST" action="?/move">
							<input type="hidden" name="photoId" value={it.id} /><input
								type="hidden"
								name="dir"
								value="up"
							/><button type="submit" disabled={i === 0} title="앞으로">←</button>
						</form>
						<form method="POST" action="?/move">
							<input type="hidden" name="photoId" value={it.id} /><input
								type="hidden"
								name="dir"
								value="down"
							/><button type="submit" disabled={i === c.items.length - 1} title="뒤로">→</button>
						</form>
					{/if}
					<form method="POST" action="?/cover">
						<input type="hidden" name="photoId" value={it.id} /><button type="submit" title="커버로"
							>{c.coverPhotoId === it.id ? '커버' : '커버로'}</button
						>
					</form>
					{#if c.kind === 'manual'}
						<form method="POST" action="?/remove">
							<input type="hidden" name="photoId" value={it.id} /><button
								type="submit"
								class="danger"
								title="빼기">×</button
							>
						</form>
					{/if}
				</div>
			</div>
		{/each}
	</div>
</section>

<style>
	.edit {
		max-width: 760px;
	}
	.cols {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
		gap: 0 16px;
	}
	.rule {
		margin-left: 14px;
	}
	.inline {
		margin: 10px 0 0;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
		gap: 14px;
	}
	.cell img {
		display: block;
		width: 100%;
		aspect-ratio: 3 / 2;
		object-fit: cover;
		background: #000;
	}
	.cell.cover img {
		outline: 2px solid var(--color-amber);
	}
	.acts {
		display: flex;
		gap: 4px;
		margin-top: 6px;
		font-size: 15px;
	}
	.acts button {
		background: none;
		border: 1px solid var(--color-ink-faint);
		color: var(--color-ink-dim);
		padding: 3px 8px;
		border-radius: 2px;
		cursor: pointer;
		font: inherit;
	}
	.acts button:hover:not(:disabled) {
		color: var(--color-ink);
		border-color: var(--color-ink);
	}
	.acts button:disabled {
		opacity: 0.3;
	}
	.acts .danger {
		color: #d98a7a;
	}
</style>
