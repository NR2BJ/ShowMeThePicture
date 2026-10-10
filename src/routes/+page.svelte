<script lang="ts">
	import FilmStrip from '#lib/components/FilmStrip.svelte';
	import type { Frame, StripRow } from '#lib/types.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const LAYOUT = [
		{ dur: 110, tilt: -1.1, dir: 'left' },
		{ dur: 135, tilt: 0.9, dir: 'right' },
		{ dur: 120, tilt: -0.7, dir: 'left' }
	] as const;
	const MIN_PER_ROW = 12;

	function placeholders(n: number): Frame[] {
		return Array.from({ length: n }, (_, i) => ({
			id: `empty-${i}`,
			src: null,
			label: 'NO PHOTOS YET',
			num: String((i % 36) + 1).padStart(2, '0')
		}));
	}
	/** 줄에 프레임이 너무 적으면 반복해서 채운다 (마퀴가 비어 보이지 않게) */
	function pad(frames: Frame[], min: number): Frame[] {
		if (frames.length === 0) return [];
		const out: Frame[] = [];
		while (out.length < min) out.push(...frames);
		return out;
	}

	const rows: StripRow[] = $derived.by(() => {
		const src = data.frames.length ? data.frames : placeholders(MIN_PER_ROW * LAYOUT.length);
		return LAYOUT.map((l, i) => ({
			...l,
			frames: pad(
				src.filter((_, j) => j % LAYOUT.length === i),
				MIN_PER_ROW
			)
		}));
	});
</script>

<main class="landing">
	<FilmStrip {rows} frameVh={data.stripVh} />
	{#if data.frames.length === 0}
		<p class="empty mono">
			아직 등록된 사진이 없습니다 · 관리자로 로그인해 라이브러리에 폴더를 등록하세요
		</p>
	{/if}
</main>

<style>
	.landing {
		height: 100dvh;
		overflow: hidden;
		padding: 72px 0 36px;
		box-sizing: border-box;
	}
	.empty {
		position: fixed;
		inset: auto 0 0 0;
		z-index: 10;
		padding: 22px 40px;
		font-size: 13px;
		letter-spacing: 0.04em;
		color: var(--color-ink-dim);
	}
</style>
