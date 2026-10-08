<script lang="ts">
	import { page } from '$app/state';
	import PageStub from '#lib/components/PageStub.svelte';
</script>

<PageStub title="사진" phase={2} note={`원본 ⇄ 보정 토글, 스펙 시트 · id ${page.params.id}`} />
