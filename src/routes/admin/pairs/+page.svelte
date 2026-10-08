<script lang="ts">
	import type { PageProps } from './$types';
	let { data, form }: PageProps = $props();
	const d = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('ko-KR') : '-');
</script>

<section class="admin-page">
	<h1>페어링</h1>
	<p class="mono dim">
		보정본과 원본을 한 장으로 묶습니다. 파일명(stem)·촬영시각·카메라·pHash 로 점수를 매겨 0.8 이상은
		자동, 0.5~0.8 은 여기서 검토합니다. 지금까지 묶인 사진 {data.pairedCount}장.
	</p>
	{#if data.originals.total === 0}
		<p class="notice error">
			원본(역할: 원본) 라이브러리에 파일이 없습니다. 원본 폴더를 먼저 등록하세요.
		</p>
	{:else if data.originals.ready < data.originals.total}
		<p class="notice">
			원본 {data.originals.total}장 중 처리 완료 {data.originals.ready}장{#if data.originals.failed}
				· 실패 {data.originals.failed}장(대시보드에서 사유 확인){/if}{#if data.originals.missing}
				· 없어짐 {data.originals.missing}장{/if}. 페어링은 처리가 끝난 원본만 후보로 잡고, 원본이
			처리되면 자동으로 다시 묶입니다.
		</p>
	{/if}
	{#if form?.error}<p class="notice error">{form.error}</p>{/if}
	{#if form?.ok}<p class="notice">{form.ok}</p>{/if}
	<form method="POST" action="?/rerun">
		<button class="btn quiet" type="submit">미페어링 전체 다시 페어링</button>
	</form>

	<h2>검토 필요 ({data.review.length})</h2>
	{#if data.review.length === 0}<p class="dim">없습니다.</p>{/if}
	{#each data.review as r (r.edit.id)}
		<div class="pair">
			<figure>
				<img src={r.edit.thumb} alt="" />
				<figcaption class="mono">
					보정 · {r.edit.filename}<br /><span class="dim"
						>{r.edit.source} · {d(r.edit.takenAt)}</span
					>
				</figcaption>
			</figure>
			<div class="mid mono">
				<span class="score">{r.score.toFixed(2)}</span><span class="dim">{r.method}</span>
			</div>
			<figure>
				<img src={r.original.thumb} alt="" />
				<figcaption class="mono">
					원본 · {r.original.filename}<br /><span class="dim"
						>{r.original.source} · {d(r.original.takenAt)}</span
					>
				</figcaption>
			</figure>
			<div class="acts">
				<form method="POST" action="?/confirm">
					<input type="hidden" name="editId" value={r.edit.id} /><input
						type="hidden"
						name="originalId"
						value={r.original.id}
					/><button class="btn primary" type="submit">맞음</button>
				</form>
				<form method="POST" action="?/reject">
					<input type="hidden" name="editId" value={r.edit.id} /><button
						class="btn quiet"
						type="submit">아님</button
					>
				</form>
			</div>
		</div>
	{/each}

	<h2>자동으로 묶임 · 미확정 ({data.auto.length})</h2>
	{#if data.auto.length === 0}<p class="dim">없습니다.</p>{/if}
	{#each data.auto as r (r.edit.id)}
		<div class="pair">
			<figure>
				<img src={r.edit.thumb} alt="" />
				<figcaption class="mono">보정 · {r.edit.filename}</figcaption>
			</figure>
			<div class="mid mono">
				<span class="score">{r.score?.toFixed(2) ?? '-'}</span><span class="dim">{r.method}</span>
			</div>
			<figure>
				<img src={r.original.thumb} alt="" />
				<figcaption class="mono">
					원본 · {r.original.filename}<br /><span class="dim">{r.original.source}</span>
				</figcaption>
			</figure>
			<div class="acts">
				<form method="POST" action="?/accept">
					<input type="hidden" name="photoId" value={r.photoId} /><button class="btn" type="submit"
						>확정</button
					>
				</form>
				<form method="POST" action="?/unpair">
					<input type="hidden" name="editId" value={r.edit.id} /><button
						class="btn danger"
						type="submit">풀기</button
					>
				</form>
			</div>
		</div>
	{/each}

	<h2>원본 없는 보정본 ({data.unpaired.length})</h2>
	{#if data.unpaired.length === 0}<p class="dim">없습니다.</p>{/if}
	{#each data.unpaired as u (u.id)}
		<div class="pair single">
			<figure>
				<img src={u.thumb} alt="" />
				<figcaption class="mono">
					{u.filename}<br /><span class="dim">{u.source} · {u.relPath}</span>
				</figcaption>
			</figure>
			<form method="POST" action="?/manual" class="manual">
				<input type="hidden" name="editId" value={u.id} />
				<label class="field"
					><span>원본 파일명으로 직접 연결</span><input
						type="text"
						name="query"
						placeholder="예: SAM_0012"
					/></label
				>
				<button class="btn" type="submit">연결</button>
			</form>
		</div>
	{/each}
</section>

<style>
	.pair {
		display: grid;
		grid-template-columns: 220px 70px 220px 1fr;
		gap: 16px;
		align-items: center;
		padding: 12px 0;
		border-bottom: 1px solid rgba(69, 66, 61, 0.5);
	}
	.pair.single {
		grid-template-columns: 220px 1fr;
	}
	figure {
		margin: 0;
	}
	figure img {
		display: block;
		width: 220px;
		height: 150px;
		object-fit: contain;
		background: #000;
	}
	figcaption {
		font-size: 12px;
		margin-top: 6px;
		line-height: 1.4;
	}
	.mid {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		font-size: 12px;
	}
	.score {
		font-size: 18px;
		color: var(--color-amber);
	}
	.acts {
		display: flex;
		gap: 8px;
	}
	.manual {
		display: flex;
		gap: 10px;
		align-items: flex-end;
		max-width: 480px;
	}
	.manual .field {
		flex: 1;
		margin: 0;
	}
	@media (max-width: 760px) {
		.pair,
		.pair.single {
			grid-template-columns: 1fr;
		}
	}
</style>
