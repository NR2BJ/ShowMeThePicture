<script lang="ts">
	import type { PageProps } from './$types';
	let { data, form }: PageProps = $props();
	const d = (iso: string) => new Date(iso).toLocaleString('ko-KR');
</script>

<section class="admin-page">
	<h1>직접 바꾼 공개 설정</h1>
	<p class="mono dim">
		사진 페이지에서 '공개하기/숨기기'로 바꾼 사진들입니다. 폴더 기본값 일괄 적용에서는 제외되며,
		여기서 되돌릴 수 있습니다.
	</p>
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
							<form method="POST" action="?/toggle">
								<input type="hidden" name="photoId" value={o.id} /><input
									type="hidden"
									name="visibility"
									value={o.visibility === 'public' ? 'hidden' : 'public'}
								/><button class="btn quiet" type="submit"
									>{o.visibility === 'public' ? '숨기기' : '공개하기'}</button
								>
							</form>
							<form method="POST" action="?/reset">
								<input type="hidden" name="photoId" value={o.id} /><button
									class="btn quiet"
									type="submit">기본값으로</button
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
