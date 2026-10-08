<script lang="ts">
	import { page } from '$app/state';
	import PageStub from '#lib/components/PageStub.svelte';
</script>

<PageStub
	title={`라이브러리 · ${page.params.slug}`}
	phase={1}
	note="Source 통째로, 하위 폴더 평탄화, RAW 우선"
/>
