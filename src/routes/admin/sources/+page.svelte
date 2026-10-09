<script lang="ts">
	import { autoRefresh } from '#lib/actions/autoRefresh.ts';
	import FolderPicker from '#lib/components/FolderPicker.svelte';
	import { EXPOSURE_SHORT, toExposure } from '#lib/exposure.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	let relPath = $state('');
	let name = $state('');
	let role = $state<'original' | 'edit'>('original');
	let tier = $state<'A' | 'B'>('A');
	let nameTouched = $state(false);
	$effect(() => {
		if (!nameTouched) name = relPath.split('/').filter(Boolean).pop() ?? '';
	});
	// 권장 기본값: 원본 → 숨김, 보정 A컷 → 공개, 보정 B컷 → 숨김
	const recommended = $derived(role === 'edit' && tier === 'A' ? 'photos' : 'private');
	const roleLabel = (r: string) => (r === 'edit' ? '보정' : '원본');
	const busy = $derived(data.sources.some((s) => s.pendingCount > 0));
</script>

<section class="admin-page" use:autoRefresh={busy ? 4000 : 20000}>
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
			<thead>
				<tr>
					<th>이름</th>
					<th>역할 · 컷</th>
					<th>파일 / 처리 / 없어짐</th>
					<th>공개 범위</th>
					<th>사진 공개 현황</th>
					<th></th>
				</tr>
			</thead>
			<tbody>
				{#each data.sources as s (s.id)}
					{@const st = data.stats[s.id]}
					<tr>
						<td>
							<a href={`/library/${s.slug}`}>{s.name}</a>
							<div class="mono dim">{s.rootPath}</div>
						</td>
						<td class="mono"
							>{roleLabel(s.role)}{s.medium
								? ` · ${s.medium === 'film' ? '필름' : '디지털'}`
								: ''}{s.tier ? ` · ${s.tier}컷` : ''}</td
						>
						<td class="mono">{s.fileCount} / {s.indexedCount} / {s.missingCount}</td>
						<td class="mono">{EXPOSURE_SHORT[toExposure(s.defaultVisibility, s.libraryPublic)]}</td>
						<td class="mono">
							공개 {st?.publicCount ?? 0} · 숨김 {st?.hiddenCount ?? 0}
							{#if st?.manualCount}<span class="dim"> · 수동 {st.manualCount}</span>{/if}
						</td>
						<td class="actions">
							<a class="btn quiet" href={`/admin/sources/${s.id}`}>수정</a>
							<form method="POST" action="?/scan">
								<input type="hidden" name="id" value={s.id} />
								<input type="hidden" name="full" value="on" />
								<button class="btn quiet" type="submit">지금 스캔</button>
							</form>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
		<p class="mono dim hint">
			'공개 범위' = 이 폴더 사진의 게스트 공개 여부(비공개 / 사진만 / 사진 + 폴더 페이지). '사진
			공개 현황' = 지금 실제 상태(직접 바꾼 사진은 '수동'). 컷(A/B)은 분류 라벨일 뿐입니다.
		</p>
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
			<label class="field">
				<span>역할</span>
				<select name="role" bind:value={role}>
					<option value="original">원본 (카메라/스캔 파일)</option>
					<option value="edit">보정 (export 한 파일)</option>
				</select>
			</label>
			<label class="field">
				<span>매체</span>
				<select name="medium">
					<option value="">— 지정 안 함</option>
					<option value="digital">디지털</option>
					<option value="film">필름</option>
				</select>
			</label>
			{#if role === 'edit'}
				<label class="field">
					<span>컷 (분류 라벨)</span>
					<select name="tier" bind:value={tier}>
						<option value="A">A컷 (걸작)</option>
						<option value="B">B컷</option>
					</select>
				</label>
			{/if}
			<label class="field">
				<span>게스트 공개 범위</span>
				{#key recommended}
					<select name="exposure">
						<option value="private" selected={recommended === 'private'}>비공개 — 관리자만</option>
						<option value="photos" selected={recommended === 'photos'}
							>사진만 공개 — 아카이브·랜딩·컬렉션</option
						>
						<option value="all">사진 + 폴더 페이지 공개 — /library/… 도 열림</option>
					</select>
				{/key}
			</label>
		</div>
		<label class="check mono"
			><input type="checkbox" name="libraryPublic" /> 폴더 페이지(/library/…)를 게스트에게도 열기 — 그
			안에서도 공개 사진만 보입니다</label
		>
		<p class="mono dim hint">
			권장값이 자동으로 들어갑니다: 원본은 숨김, 보정 A컷은 공개, B컷은 숨김. 등록 뒤에는 '수정'에서
			바꾸고 기존 사진에 일괄 적용할 수 있습니다.
		</p>
		<button class="btn primary" type="submit">등록하고 스캔</button>
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
	.hint {
		font-size: 12px;
		margin: 10px 0 18px;
		max-width: 760px;
	}
	.check {
		display: flex;
		gap: 8px;
		align-items: center;
		font-size: 12px;
		margin: 4px 0 8px;
		color: var(--color-ink-dim);
	}
</style>
