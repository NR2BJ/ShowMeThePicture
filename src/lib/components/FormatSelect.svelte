<script lang="ts">
	// 포맷 고르기: 프리셋(디지털 / 135 / 120 / 시트) + '기타 (직접 입력)'. 실제 값은 hidden input 으로 넘긴다.
	// 프리셋에 없는 기존 값은 '기타'로 열려 그대로 보존된다.
	import {
		DIGITAL_FORMATS,
		FILM_FORMATS_120,
		FILM_FORMATS_135,
		FILM_FORMATS_SHEET,
		FORMAT_LABEL
	} from '#lib/formats.ts';

	let {
		name,
		value = null,
		kind = 'any'
	}: { name: string; value?: string | null; kind?: 'film' | 'any' } = $props();

	const OTHER = '__other__';
	const presets = $derived<string[]>([
		...(kind === 'film' ? [] : DIGITAL_FORMATS),
		...FILM_FORMATS_135,
		...FILM_FORMATS_120,
		...FILM_FORMATS_SHEET
	]);
	const label = (f: string) => FORMAT_LABEL[f] ?? f;
	// svelte-ignore state_referenced_locally
	let sel = $state(value ? (presets.includes(value) ? value : OTHER) : '');
	// svelte-ignore state_referenced_locally
	let custom = $state(value && !presets.includes(value) ? value : '');
	const out = $derived(sel === OTHER ? custom.trim() : sel);
</script>

<input type="hidden" {name} value={out} />
<div class="fmt">
	<select bind:value={sel}>
		<option value="">(없음)</option>
		{#if kind !== 'film'}
			<optgroup label="디지털">
				{#each DIGITAL_FORMATS as f (f)}<option value={f}>{label(f)}</option>{/each}
			</optgroup>
		{/if}
		<optgroup label="135">
			{#each FILM_FORMATS_135 as f (f)}<option value={f}>{f}</option>{/each}
		</optgroup>
		<optgroup label="120">
			{#each FILM_FORMATS_120 as f (f)}<option value={f}>{f}</option>{/each}
		</optgroup>
		<optgroup label="시트">
			{#each FILM_FORMATS_SHEET as f (f)}<option value={f}>{f}</option>{/each}
		</optgroup>
		<option value={OTHER}>기타 (직접 입력)</option>
	</select>
	{#if sel === OTHER}
		<input type="text" bind:value={custom} placeholder="예: 110, 폰카, 토이" />
	{/if}
</div>

<style>
	/* 셀렉트 아래에 입력칸 — 옆에 두면 좁은 칸에서 이웃 필드에 가린다 */
	.fmt {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.fmt select,
	.fmt input {
		width: 100%;
		min-width: 0;
	}
</style>
