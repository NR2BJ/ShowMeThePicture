<script lang="ts">
	import type { PageProps } from './$types';
	let { data, form }: PageProps = $props();
	const d = (iso: string) => new Date(iso).toLocaleString('ko-KR');
</script>

<section class="admin-page">
	<h1>직접 바꾼 공개 설정</h1>
	{#if form?.error}<p class="notice error">{form.error}</p>{/if}
	{#if form?.ok}<p class="notice">{form.ok}</p>{/if}
	{#if data.overrides.length === 0}
		<p class="dim">아직 없습니다.</p>
	{:else}
		<table class="table">
			<thead
				><tr
					><th></th><th>파일</th><th>라이브러리</th><th>지금</th><th>폴더 기본값</th><th
						>바꾼 시각</th
					><th></th></tr
				></thead
			>
			<tbody>
				{#each data.overrides as o (o.id)}
					<tr>
						<td><a href={`/p/${o.id}`}><img src={o.thumb} alt="" class="th" /></a></td>
						<td class="mono"
							>{o.filename}{#if o.tier}
								<span class="dim">· {o.tier}컷</span>{/if}</td
						>
						<td class="mono dim">{o.source}</td>
						<td class="mono" class:pub={o.visibility === 'public'}
							>{o.visibility === 'public' ? '공개' : '숨김'}</td
						>
						<td class="mono dim"
							>{o.defaultVisibility === 'public'
								? '공개'
								: '숨김'}{#if o.defaultVisibility === o.visibility}
								(같음){/if}</td
						>
						<td class="mono dim">{d(o.updatedAt)}</td>
						<td class="acts">
							<form method="POST" action="?/reset">
								<input type="hidden" name="photoId" value={o.id} /><button
									class="btn quiet"
									type="submit"
									>{o.defaultVisibility === o.visibility
										? '수동 표시 해제'
										: o.defaultVisibility === 'public'
											? '공개하기'
											: '숨기기'}</button
								>
							</form>
						</td>
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
	.pub {
		color: var(--color-amber);
	}
	.acts {
		display: flex;
		gap: 6px;
		white-space: nowrap;
	}
</style>
