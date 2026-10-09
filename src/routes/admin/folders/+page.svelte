<script lang="ts">
	import GearSelect from '#lib/components/GearSelect.svelte';
	import type { PageProps } from './$types';
	let { data, form }: PageProps = $props();
	const month = (d: string | null) => (d ? d.slice(0, 7) : '');
	const bySource = $derived.by(() => {
		const m = new Map<string, typeof data.folders>();
		for (const f of data.folders) {
			const k = f.sourceName;
			if (!m.has(k)) m.set(k, []);
			m.get(k)!.push(f);
		}
		return [...m.entries()];
	});
</script>

<section class="admin-page">
	<h1>폴더 정보</h1>
	<p class="mono dim">
		필름 롤처럼 EXIF 가 없는 폴더에 현상월·카메라·렌즈·필름을 준다. 폴더명이 <code
			>2509_01 Rollei35s colorplus200</code
		>
		처럼 현상월_롤번호로 시작하면 스캔 때 날짜·롤 번호를 읽고,
		<a href="/admin/gear">장비</a>에 등록된 이름이 폴더명에 있으면 카메라·렌즈·필름도 자동으로
		채워진다. 저장하면 그 폴더 안 파일의 날짜가 현상월(파일명 순)로 맞춰진다 — 스캐너가 EXIF 에 넣은
		스캔 날짜도 덮어쓴다. 사진 하나만 다른 장비면 그 사진 페이지의 정보 드로어에서 따로 고친다.
	</p>
	{#if form?.error}<p class="notice error">{form.error}</p>{/if}
	{#if form?.saved}<p class="notice">
			'{form.title}' 저장. {#if form.hasDate}파일 {form.applied}개의 날짜를 현상월로 맞췄습니다.{:else}현상월이
				비어 있어 날짜는 그대로 두었습니다.{/if}
		</p>{/if}
	{#if form?.all}<p class="notice">
			폴더 {form.all.folders}개, 파일 {form.all.files}개의 날짜를 현상월로 맞췄습니다.
		</p>{/if}
	<form method="POST" action="?/applyAll" class="all">
		<button class="btn quiet" type="submit">모든 폴더 날짜 다시 맞추기</button>
	</form>

	{#if data.folders.length === 0}
		<p class="dim">아직 없습니다. 필름 라이브러리를 등록하고 스캔하면 폴더가 나타납니다.</p>
	{/if}
	{#each bySource as [name, rows] (name)}
		<h2>{name}</h2>
		{#each rows as f (f.id)}
			<form method="POST" action="?/save" class="roll">
				<input type="hidden" name="id" value={f.id} />
				<div class="head">
					<span class="mono">{f.relDir || '(루트)'}</span>
					<span class="mono dim">{f.fileCount}장</span>
				</div>
				<div class="grid">
					<label class="field"
						><span>제목</span><input type="text" name="title" value={f.title ?? ''} /></label
					>
					<label class="field"
						><span>현상월</span><input
							type="month"
							name="developedAt"
							value={month(f.developedAt)}
						/></label
					>
					<label class="field"
						><span>롤 번호</span><input
							type="text"
							name="rollNo"
							inputmode="numeric"
							value={f.rollNo ?? ''}
						/></label
					>
					<label class="field"
						><span>카메라</span><GearSelect
							name="camera"
							value={f.camera}
							options={data.gear.camera}
						/></label
					>
					<label class="field"
						><span>렌즈</span><GearSelect
							name="lens"
							value={f.lens}
							options={data.gear.lens}
						/></label
					>
					<label class="field"
						><span>필름</span><GearSelect
							name="filmStock"
							value={f.filmStock}
							options={data.gear.film}
						/></label
					>
					<label class="field"
						><span>포맷</span><input
							type="text"
							name="filmFormat"
							value={f.filmFormat ?? ''}
							placeholder="35mm / 120"
						/></label
					>
					<label class="field"
						><span>스캐너</span><input type="text" name="scanner" value={f.scanner ?? ''} /></label
					>
					<label class="field wide"
						><span>메모</span><input type="text" name="notes" value={f.notes ?? ''} /></label
					>
				</div>
				<button class="btn" type="submit">저장하고 날짜 맞추기</button>
			</form>
		{/each}
	{/each}
</section>

<style>
	code {
		font-family: var(--font-mono);
	}
	.all {
		margin: 0 0 18px;
	}
	.roll {
		border: 1px solid var(--color-ink-faint);
		border-radius: 2px;
		padding: 14px 16px 16px;
		margin: 0 0 14px;
	}
	.head {
		display: flex;
		justify-content: space-between;
		margin: 0 0 12px;
		font-size: 13px;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
		gap: 0 14px;
	}
	.grid .field {
		margin-bottom: 12px;
	}
	.grid .wide {
		grid-column: 1 / -1;
	}
	.grid input[type='month'] {
		background: #141311;
		border: 1px solid var(--color-ink-faint);
		color: var(--color-ink);
		padding: 11px 13px;
		font: inherit;
		border-radius: 2px;
		color-scheme: dark;
	}
</style>
