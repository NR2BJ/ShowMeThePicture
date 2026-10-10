<script lang="ts">
	// 포맷 드롭다운: 디지털(센서) / 필름(규격) 프리셋만. 목록에 없는 기존 값은 '(예전 값)' 으로 남겨 보존한다.
	import { DIGITAL_FORMATS, FILM_FORMATS, FORMAT_LABEL } from '#lib/formats.ts';

	let {
		name,
		value = null,
		kind = 'any'
	}: { name: string; value?: string | null; kind?: 'film' | 'any' } = $props();
	const known = $derived<string[]>([...(kind === 'film' ? [] : DIGITAL_FORMATS), ...FILM_FORMATS]);
	const legacy = $derived(value && !known.includes(value) ? value : null);
	const label = (f: string) => FORMAT_LABEL[f] ?? f;
</script>

<select {name}>
	<option value="" selected={!value}>(없음)</option>
	{#if legacy}<option value={legacy} selected>{legacy} (예전 값)</option>{/if}
	{#if kind !== 'film'}
		<optgroup label="디지털">
			{#each DIGITAL_FORMATS as f (f)}<option value={f} selected={f === value}>{label(f)}</option
				>{/each}
		</optgroup>
	{/if}
	<optgroup label="필름">
		{#each FILM_FORMATS as f (f)}<option value={f} selected={f === value}>{label(f)}</option>{/each}
	</optgroup>
</select>
