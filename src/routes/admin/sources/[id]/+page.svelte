<script lang="ts">
	import type { PageProps } from './$types';
	let { data, form }: PageProps = $props();
	const s = $derived(data.s);
</script>

<section class="admin-page">
	<p class="mono dim">
		<a href="/admin/sources">← 라이브러리</a> · <a href={`/library/${s.slug}`}>/library/{s.slug}</a>
	</p>
	<h1>{s.name}</h1>
	<p class="mono dim">{s.rootPath}</p>
	{#if form?.error}<p class="notice error">{form.error}</p>{/if}
	{#if form?.ok}<p class="notice">{form.ok}</p>{/if}

	<h2>현재 사진 공개 현황</h2>
	<p class="mono">
		공개 {data.stats.publicCount}장 · 숨김 {data.stats.hiddenCount}장 · 그중 직접 바꾼 것 {data
			.stats.manualCount}장 <a href="/admin/visibility" class="dim">(직접 바꾼 사진 보기)</a>
	</p>

	<h2>설정</h2>
	<form method="POST" action="?/save" class="edit">
		<label class="field"><span>이름</span><input type="text" name="name" value={s.name} /></label>
		<div class="cols">
			<label class="field"
				><span>역할 (변경 불가)</span><input
					type="text"
					value={s.role === 'edit' ? '보정' : '원본'}
					disabled
				/></label
			>
			<label class="field"
				><span>매체</span>
				<select name="medium">
					<option value="" selected={!s.medium}>— 지정 안 함</option>
					<option value="digital" selected={s.medium === 'digital'}>디지털</option>
					<option value="film" selected={s.medium === 'film'}>필름</option>
				</select>
			</label>
			{#if s.role === 'edit'}
				<label class="field"
					><span>컷 (분류 라벨)</span>
					<select name="tier">
						<option value="A" selected={s.tier === 'A'}>A컷</option>
						<option value="B" selected={s.tier === 'B'}>B컷</option>
					</select>
				</label>
			{/if}
			<label class="field"
				><span>스캔 주기 (분)</span><input
					type="text"
					name="pollIntervalMin"
					inputmode="numeric"
					value={s.pollIntervalMin}
				/></label
			>
		</div>

		<h2>게스트에게 보이는 범위</h2>
		<div class="cols">
			<label class="field"
				><span>이 폴더에서 찾는 사진의 공개 여부</span>
				<select name="defaultVisibility">
					<option value="public" selected={s.defaultVisibility === 'public'}
						>공개 — 아카이브·랜딩·컬렉션에 보임</option
					>
					<option value="hidden" selected={s.defaultVisibility === 'hidden'}>숨김 — 관리자만</option
					>
				</select>
			</label>
		</div>
		<label class="check mono"
			><input type="checkbox" name="applyExisting" /> 이미 있는 사진에도 지금 적용</label
		>
		<label class="check mono sub"
			><input type="checkbox" name="includeManual" /> 직접 바꾼 사진까지 포함 (끄면 수동 설정은 유지)</label
		>
		<label class="check mono"
			><input type="checkbox" name="libraryPublic" checked={s.libraryPublic} /> 폴더
			페이지(/library/{s.slug})를 게스트에게 열기 — 그 안에서도 공개 사진만 보입니다</label
		>
		<button class="btn primary" type="submit">저장</button>
	</form>

	<h2>일괄 작업</h2>
	<div class="bulk">
		<form method="POST" action="?/bulk">
			<input type="hidden" name="visibility" value="hidden" /><button class="btn" type="submit"
				>이 폴더 사진 전부 숨김</button
			>
		</form>
		<form method="POST" action="?/bulk">
			<input type="hidden" name="visibility" value="public" /><button class="btn" type="submit"
				>전부 공개</button
			>
		</form>
		<form method="POST" action="?/bulk">
			<input type="hidden" name="visibility" value="hidden" /><input
				type="hidden"
				name="includeManual"
				value="on"
			/><button class="btn quiet" type="submit">전부 숨김 (직접 바꾼 것 포함)</button>
		</form>
		<form method="POST" action="?/scan">
			<button class="btn quiet" type="submit">지금 스캔</button>
		</form>
		<form
			method="POST"
			action="?/delete"
			onsubmit={(e) => {
				if (!confirm(`'${s.name}' 등록을 삭제할까요? 디스크 파일은 그대로 둡니다.`))
					e.preventDefault();
			}}
		>
			<button class="btn danger" type="submit">등록 삭제</button>
		</form>
	</div>
	<p class="mono dim">
		컷(A/B)은 분류 라벨일 뿐입니다. B컷은 설정의 B컷 정책(기본: 아카이브·랜딩에서 제외)에 따라 따로
		걸러집니다.
	</p>
</section>

<style>
	.edit {
		max-width: 760px;
	}
	.cols {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 0 16px;
	}
	.check {
		display: flex;
		gap: 8px;
		align-items: center;
		font-size: 12px;
		margin: 2px 0 12px;
		color: var(--color-ink-dim);
	}
	.check.sub {
		margin-left: 22px;
	}
	.bulk {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin: 0 0 12px;
	}
</style>
