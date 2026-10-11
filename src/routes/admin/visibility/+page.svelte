<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';
	let { data, form }: PageProps = $props();
	const d = (iso: string) => new Date(iso).toLocaleString('ko-KR');
	const vis = (v: 'public' | 'hidden') => (v === 'public' ? '공개' : '숨김');
	const cut = (t: 'A' | 'B' | null) => (t ? `${t}컷` : '없음');
</script>

<section class="admin-page">
	<h1>직접 바꾼 사진</h1>
	{#if form?.error}<p class="notice error">{form.error}</p>{/if}
	{#if form?.ok}<p class="notice">{form.ok}</p>{/if}
	{#if data.overrides.length === 0}
		<p class="dim">아직 없습니다.</p>
	{:else}
		<table class="table">
			<thead
				><tr
					><th></th><th>파일</th><th>라이브러리</th><th>공개 · 기본값</th><th>컷 · 자동</th><th
						>바꾼 시각</th
					></tr
				></thead
			>
			<tbody>
				{#each data.overrides as o (o.id)}
					<tr>
						<td><a href={`/p/${o.id}`}><img src={o.thumb} alt="" class="th" /></a></td>
						<td class="mono">{o.filename}</td>
						<td class="mono dim">{o.source}</td>
						<td>
							<div class="cell">
								<span class="mono" class:on={o.visibility === 'public'}>{vis(o.visibility)}</span>
								{#if o.visibilityManual}
									<span class="mono dim">· 기본 {vis(o.defaultVisibility)}</span>
									<form method="POST" action="?/reset" use:enhance>
										<input type="hidden" name="photoId" value={o.id} /><button
											class="btn quiet"
											type="submit"
											>{o.defaultVisibility === o.visibility
												? '수동 표시 해제'
												: '기본값으로'}</button
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
											type="submit"
											>{o.defaultTier === o.tier ? '수동 표시 해제' : '자동으로'}</button
										>
									</form>
								{:else}<span class="mono dim">· 자동</span>{/if}
							</div>
						</td>
						<td class="mono dim">{d(o.updatedAt)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</section>

<style>
	.th {
		display: block;
		width: 96px;
		height: 64px;
		object-fit: cover;
		background: #000;
	}
	.on {
		color: var(--color-amber);
	}
	.cell {
		display: flex;
		align-items: center;
		gap: 8px;
		white-space: nowrap;
	}
</style>
