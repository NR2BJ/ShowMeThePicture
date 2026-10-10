<script lang="ts">
	import type { PageProps } from './$types';
	let { data, form }: PageProps = $props();
	const s = $derived(data.s);
	let role = $state<'original' | 'edit'>('original');
	$effect(() => {
		role = s.role;
	});
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
			.stats.manualCount}장
		<a href="/admin/visibility" class="dim">(직접 바꾼 사진 보기)</a>
	</p>

	<h2>설정</h2>
	<form method="POST" action="?/save" class="edit">
		<label class="field"><span>이름</span><input type="text" name="name" value={s.name} /></label>
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
					<option value="" selected={!s.medium}>— 지정 안 함</option>
					<option value="digital" selected={s.medium === 'digital'}>디지털</option>
					<option value="film" selected={s.medium === 'film'}>필름</option>
				</select>
			</label>
			{#if role === 'edit'}
				<label class="field">
					<span>컷 (분류 라벨)</span>
					<select name="tier">
						<option value="A" selected={s.tier !== 'B'}>A컷</option>
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
		{#if role !== s.role}
			<p class="notice">
				역할을 바꾸면 이 폴더 파일의 사진 묶음(RAW+JPG / 보정본)과 페어링을 워커가 다시 계산합니다.
				파생 이미지는 그대로 둡니다.
			</p>
		{/if}

		<h2>게스트에게 보이는 범위</h2>
		<label class="field">
			<span>게스트 공개</span>
			<select name="visibility">
				<option value="hidden" selected={s.defaultVisibility !== 'public'}
					>비공개 — 관리자만 본다</option
				>
				<option value="public" selected={s.defaultVisibility === 'public'}
					>공개 — 아카이브·랜딩·컬렉션에 보임</option
				>
			</select>
		</label>
		<p class="mono dim hint">
			저장하면 이 폴더의 기존 사진에도 바로 적용되고, 새로 찾는 사진도 같은 설정을 따릅니다. 폴더
			페이지(/library/{s.slug})는 관리자 전용 작업 화면이라 게스트 설정과 무관합니다.
		</p>
		<label class="check mono"
			><input type="checkbox" name="includeManual" /> 사진 페이지에서 직접 바꾼 사진({data.stats
				.manualCount}장)도 덮어쓰기</label
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
		컷(A/B)은 분류 라벨입니다. 게스트에게 보이는지는 공개 여부로만 정해지고, 아카이브에서는 필터로
		컷·매체·장비별로 골라 볼 수 있습니다. 랜딩에 B컷도 보일지는 '설정'에서 고릅니다.
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
	.hint {
		font-size: 12px;
		margin: -6px 0 12px;
		max-width: 760px;
	}
	.check {
		display: flex;
		gap: 8px;
		align-items: center;
		font-size: 12px;
		margin: 2px 0 12px;
		color: var(--color-ink-dim);
	}
	.bulk {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin: 0 0 12px;
	}
</style>
