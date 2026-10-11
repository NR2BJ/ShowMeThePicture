<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';
	let { data, form }: PageProps = $props();
	const d = (iso: string) => new Date(iso).toLocaleString('ko-KR');
	const vis = (v: 'public' | 'hidden') => (v === 'public' ? '공개' : '숨김');
	const cut = (t: 'A' | 'B' | null) => (t ? `${t}컷` : '없음');
	const turn = (n: 1 | 2 | 3) => (n === 1 ? '90° 오른쪽' : n === 2 ? '180°' : '90° 왼쪽');
</script>

<!-- 공개 여부나 컷이 폴더 기본값(자동 컷)과 다르거나, 방향을 저장한 파일이 있는 사진만 나온다. 기본값과 같아지면 빠진다. -->
<section class="admin-page">
	<h1>직접 바꾼 사진</h1>
	{#if form?.error}<p class="notice error">{form.error}</p>{/if}
	{#if form?.ok}<p class="notice">{form.ok}</p>{/if}
	{#if data.overrides.length === 0}
		<p class="dim">아직 없습니다.</p>
	{:else}
		<table class="table overrides">
			<thead
				><tr
					><th></th><th>파일</th><th>라이브러리</th><th>공개 · 기본값</th><th>컷 · 자동</th><th
						>방향</th
					><th>바꾼 시각</th></tr
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
						<td class="mono dim">{d(o.updatedAt)}</td>
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
		min-height: 48px;
		white-space: nowrap;
	}
</style>
