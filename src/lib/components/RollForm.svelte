<script lang="ts">
	// 폴더(롤) 정보 폼. 고정렌즈 바디를 고르면 렌즈 칸이 그 렌즈로 잠긴다. 포맷은 카메라가 정하므로 따로 받지 않는다.
	import GearSelect from '#lib/components/GearSelect.svelte';

	type Folder = {
		id: string;
		relDir: string;
		fileCount: number;
		title: string | null;
		developedAt: string | null;
		rollNo: number | null;
		camera: string | null;
		lens: string | null;
		filmStock: string | null;
		scanner: string | null;
		notes: string | null;
	};
	let {
		folder: f,
		gear,
		fixedLens,
		tab,
		compact = false,
		onclose
	}: {
		folder: Folder;
		gear: { camera: string[]; lens: string[]; film: string[] };
		fixedLens: Record<string, string>;
		tab: string;
		compact?: boolean;
		onclose?: () => void;
	} = $props();

	const month = (d: string | null) => (d ? d.slice(0, 7) : '');
	// svelte-ignore state_referenced_locally
	let camera = $state(f.camera ?? '');
	const cameraOptions = $derived(
		camera && !gear.camera.includes(camera) ? [camera, ...gear.camera] : gear.camera
	);
	const locked = $derived(fixedLens[camera] ?? null);
</script>

<form method="POST" action={`?/save&tab=${tab}`} class="roll" class:compact>
	<input type="hidden" name="id" value={f.id} />
	{#if !compact}
		<div class="head">
			<span class="mono">{f.relDir || '(루트)'}</span>
			<span class="mono dim">{f.fileCount}장</span>
		</div>
	{/if}
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
		<label class="field">
			<span>카메라</span>
			<select name="camera" bind:value={camera}>
				<option value="">(없음)</option>
				{#each cameraOptions as o (o)}<option value={o}>{o}</option>{/each}
			</select>
		</label>
		<div class="field">
			<span>렌즈</span>
			{#if locked}
				<input type="hidden" name="lens" value={locked} />
				<div class="locked mono">{locked} <span class="dim">· 고정 렌즈</span></div>
			{:else}
				<GearSelect name="lens" value={f.lens} options={gear.lens} />
			{/if}
		</div>
		<label class="field"
			><span>필름</span><GearSelect
				name="filmStock"
				value={f.filmStock}
				options={gear.film}
			/></label
		>
		<label class="field"
			><span>스캐너</span><input type="text" name="scanner" value={f.scanner ?? ''} /></label
		>
		<label class="field wide"
			><span>메모</span><input type="text" name="notes" value={f.notes ?? ''} /></label
		>
	</div>
	<div class="acts">
		<button class="btn" type="submit">저장하고 날짜 맞추기</button>
		{#if compact && onclose}
			<button class="btn quiet" type="button" onclick={onclose}>닫기</button>
		{/if}
	</div>
</form>

<style>
	.roll {
		border: 1px solid var(--color-ink-faint);
		border-radius: 2px;
		padding: 14px 16px 16px;
		margin: 0 0 14px;
	}
	.roll.compact {
		border: 0;
		padding: 6px 0 10px;
		margin: 0;
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
	.locked {
		padding: 11px 13px;
		border: 1px dashed var(--color-ink-faint);
		border-radius: 2px;
		font-size: 13px;
	}
	.acts {
		display: flex;
		gap: 8px;
	}
</style>
