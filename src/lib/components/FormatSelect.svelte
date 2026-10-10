<script lang="ts">
	// 포맷 고르기: 프리셋(디지털 / 135 / 120 / 시트) + 전에 직접 쓴 값 + '기타 (직접 입력)'. 실제 값은 hidden input 으로 넘긴다.
	import {
		DIGITAL_FORMATS,
		FILM_FORMATS_120,
		FILM_FORMATS_135,
		FILM_FORMATS_SHEET
	} from '#lib/formats.ts';

	let {
		name,
		value = null,
		kind = 'any',
		recent = []
	}: { name: string; value?: string | null; kind?: 'film' | 'any'; recent?: string[] } = $props();

	const OTHER = '__other__';
	const presets = $derived<string[]>([
		...(kind === 'film' ? [] : DIGITAL_FORMATS),
		...FILM_FORMATS_135,
		...FILM_FORMATS_120,
		...FILM_FORMATS_SHEET
	]);
	const extra = $derived(recent.filter((r) => !presets.includes(r)));
	const known = $derived([...presets, ...extra]);
	// svelte-ignore state_referenced_locally
	let sel = $state(value ? (known.includes(value) ? value : OTHER) : '');
	// svelte-ignore state_referenced_locally
	let custom = $state(value && !known.includes(value) ? value : '');
	const out = $derived(sel === OTHER ? custom.trim() : sel);
</script>

<input type="hidden" {name} value={out} />
<div class="fmt">
	<select bind:value={sel}>
		<option value="">(없음)</option>
		{#if kind !== 'film'}
			<optgroup label="디지털">
				{#each DIGITAL_FORMATS as f (f)}<option value={f}>{f}</option>{/each}
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
		{#if extra.length}
			<optgroup label="전에 쓴 값">
				{#each extra as f (f)}<option value={f}>{f}</option>{/each}
			</optgroup>
		{/if}
		<option value={OTHER}>기타 (직접 입력)</option>
	</select>
	{#if sel === OTHER}
		<input type="text" bind:value={custom} placeholder="예: 110, 폰카, 토이" />
	{/if}
</div>

<style>
	.fmt {
		display: flex;
		gap: 8px;
	}
	.fmt select {
		flex: 1;
		min-width: 0;
	}
	.fmt input {
		flex: 1;
		min-width: 0;
	}
</style>
