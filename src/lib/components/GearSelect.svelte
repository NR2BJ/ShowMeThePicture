<script lang="ts">
	// 등록된 장비 드롭다운. 현재 값이 목록에 없으면 그 값도 옵션으로 넣어 보존한다.
	let {
		name,
		value = '',
		options,
		placeholder = '(없음)'
	}: { name: string; value?: string | null; options: string[]; placeholder?: string } = $props();
	const list = $derived(value && !options.includes(value) ? [value, ...options] : options);
</script>

<select {name}>
	<option value="" selected={!value}>{placeholder}</option>
	{#each list as o (o)}
		<option value={o} selected={o === value}>{o}</option>
	{/each}
</select>
