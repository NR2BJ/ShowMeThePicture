<script lang="ts">
	import FolderPicker from '#lib/components/FolderPicker.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	let relPath = $state('');
	let name = $state('');
	let role: 'original' | 'edit' = $state('original');
	let nameTouched = $state(false);
	$effect(() => {
		if (!nameTouched) name = relPath.split('/').filter(Boolean).pop() ?? '';
	});
	const roleLabel = (r: string) => (r === 'edit' ? '보정' : '원본');
</script>

<section class="admin-page">
	<h1>라이브러리</h1>
	<p class="mono dim">
		컨테이너의 <code>{data.photosRoot}</code> 아래에서 폴더를 고릅니다. 하위 폴더는 전부 재귀로 스캔되고,
		원본은 절대 쓰지 않습니다.
	</p>

	{#if form?.error}<p class="notice error">{form.error}</p>{/if}
	{#if form?.created}<p class="notice">
			등록했습니다. 스캔이 큐에 들어갔습니다 → <a href={`/library/${form.created}`}
				>라이브러리 보기</a
			>
		</p>{/if}
	{#if form?.scanned}<p class="notice">스캔을 큐에 넣었습니다.</p>{/if}
	{#if form?.deleted}<p class="notice">삭제했습니다. 디스크의 파일은 그대로입니다.</p>{/if}

	<h2>등록된 폴더</h2>
	{#if data.sources.length === 0}
		<p class="dim">아직 없습니다.</p>
	{:else}
		<table class="table">
			<thead
				><tr
					><th>이름</th><th>역할</th><th>파일 / 처리 / 없어짐</th><th>기본 공개</th><th
						>마지막 스캔</th
					><th></th></tr
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
							>{roleLabel(s.role)}{s.medium
								? ` · ${s.medium === 'film' ? '필름' : '디지털'}`
								: ''}{s.tier ? ` · ${s.tier}컷` : ''}</td
						>
						<td class="mono">{s.fileCount} / {s.indexedCount} / {s.missingCount}</td>
						<td class="mono"
							>{s.defaultVisibility === 'public' ? '공개' : '숨김'}{s.libraryPublic
								? ' · 라이브러리 공개'
								: ''}</td
						>
						<td class="mono dim"
							>{s.lastScannedAt ? new Date(s.lastScannedAt).toLocaleString('ko-KR') : '-'}</td
						>
						<td class="actions">
							<form method="POST" action="?/scan">
								<input type="hidden" name="id" value={s.id} /><input
									type="hidden"
									name="full"
									value="on"
								/><button class="btn quiet" type="submit">지금 스캔</button>
							</form>
							<form
								method="POST"
								action="?/delete"
								onsubmit={(e) => {
									if (!confirm(`'${s.name}' 등록을 삭제할까요? 디스크 파일은 그대로 둡니다.`))
										e.preventDefault();
								}}
							>
								<input type="hidden" name="id" value={s.id} /><button
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

	<h2>폴더 추가</h2>
	<form method="POST" action="?/create" class="create">
		<div class="field">
			<span>폴더</span>
			<FolderPicker bind:value={relPath} />
			<input type="hidden" name="relPath" value={relPath} />
			<span class="mono dim">선택: /photos/{relPath || '(루트)'}</span>
		</div>
		<label class="field"
			><span>이름</span><input
				type="text"
				name="name"
				bind:value={name}
				oninput={() => (nameTouched = true)}
			/></label
		>
		<div class="cols">
			<label class="field"
				><span>역할</span>
				<select name="role" bind:value={role}>
					<option value="original">원본 (카메라/스캔 파일)</option>
					<option value="edit">보정 (export 한 파일)</option>
				</select>
			</label>
			<label class="field"
				><span>매체</span>
				<select name="medium">
					<option value="">— 지정 안 함</option>
					<option value="digital">디지털</option>
					<option value="film">필름</option>
				</select>
			</label>
			{#if role === 'edit'}
				<label class="field"
					><span>컷</span>
					<select name="tier">
						<option value="A">A컷 (걸작)</option>
						<option value="B">B컷</option>
					</select>
				</label>
			{/if}
			<label class="field"
				><span>새 사진 기본 공개</span>
				<select name="defaultVisibility">
					<option value={role === 'edit' ? 'public' : 'hidden'}
						>{role === 'edit' ? '공개' : '숨김'} (권장)</option
					>
					<option value={role === 'edit' ? 'hidden' : 'public'}
						>{role === 'edit' ? '숨김' : '공개'}</option
					>
				</select>
			</label>
		</div>
		<label class="check mono"
			><input type="checkbox" name="libraryPublic" /> 이 라이브러리 페이지를 게스트에게도 열기</label
		>
		<button class="btn primary" type="submit" disabled={!relPath && false}>등록하고 스캔</button>
	</form>
</section>

<style>
	code {
		font-family: var(--font-mono);
	}
	.actions {
		display: flex;
		gap: 6px;
		white-space: nowrap;
	}
	.create {
		max-width: 720px;
	}
	.cols {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
		gap: 0 16px;
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
