<script lang="ts">
	import { page } from '$app/state';
	import PageStub from '#lib/components/PageStub.svelte';
</script>

<PageStub title={page.params.slug ?? '컬렉션'} phase={2} note="서문 + 편집 흐름 레이아웃" />
