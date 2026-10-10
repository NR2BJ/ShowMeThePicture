<script lang="ts">
	// 포맷 칸: 한 줄짜리 입력 + 프리셋 datalist. 목록에서 고르거나 아무 값이나 바로 쓴다 ('기타' 모드 없음, 칸 높이 고정).
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
		kind = 'any',
		placeholder = '예: 135 풀, APS-C'
	}: {
		name: string;
		value?: string | null;
		kind?: 'film' | 'any';
		placeholder?: string;
	} = $props();
	const id = $props.id();
	const presets = $derived<string[]>([
		...(kind === 'film' ? [] : DIGITAL_FORMATS),
		...FILM_FORMATS_135,
		...FILM_FORMATS_120,
		...FILM_FORMATS_SHEET
	]);
</script>

<input type="text" {name} value={value ?? ''} list={`fmt-${id}`} {placeholder} autocomplete="off" />
<datalist id={`fmt-${id}`}>
	{#each presets as f (f)}<option value={f}>{FORMAT_LABEL[f] ?? ''}</option>{/each}
</datalist>
