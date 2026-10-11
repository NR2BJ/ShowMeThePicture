<script lang="ts">
	import { onMount } from 'svelte';
	import FilmStrip from '#lib/components/FilmStrip.svelte';
	import type { Frame, StripRow } from '#lib/types.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// 줄 수는 설정값. 방향은 번갈아, 기울기·속도는 줄마다 조금씩 다르게
	const layoutFor = (n: number) =>
		Array.from({ length: n }, (_, i) => ({
			dur: 110 + ((i * 17) % 45),
			tilt: (i % 2 === 0 ? -1 : 1) * (0.7 + ((i * 7) % 5) / 10),
			dir: (i % 2 === 0 ? 'left' : 'right') as 'left' | 'right'
		}));
	const MIN_PER_ROW = 12;
	// 폰: 줄마다 6장만. 한 줄은 프레임을 두 벌 이어 붙인 긴 띠를 통째로 움직이는데, 아이폰 Safari 는 움직이는 요소가
	// 너무 길면(폰에서 7000px 넘음) 일부를 그리지 않는다 — 오른쪽으로 흐르는 줄은 띠 한가운데부터 보여서 늘 비었다.
	const PHONE_PER_ROW = 6;
	let narrow = $state(false);
	onMount(() => {
		const mq = matchMedia('(max-width: 720px)');
		narrow = mq.matches;
		const on = () => (narrow = mq.matches);
		mq.addEventListener('change', on);
		return () => mq.removeEventListener('change', on);
	});

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
		const layout = layoutFor(data.stripRows);
		const src = data.frames.length ? data.frames : placeholders(MIN_PER_ROW * layout.length);
		return layout.map((l, i) => {
			const own = src.filter((_, j) => j % layout.length === i);
			return {
				...l,
				frames: narrow ? pad(own, PHONE_PER_ROW).slice(0, PHONE_PER_ROW) : pad(own, MIN_PER_ROW)
			};
		});
	});
</script>

<main class="landing">
	<!-- 폰 판단이 바뀌면 줄을 새로 만든다 — 아이폰은 이미 돌던 애니메이션을 처음 띠 길이로 계속 돌려서, 띠가 짧아지면
	     끝을 지나 빈 곳을 보여 주거나(10~20초 뒤 사진이 사라짐) 가운데 줄이 처음부터 비었다 -->
	{#key narrow}
		<FilmStrip {rows} frameVh={data.stripVh} />
	{/key}
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
		font-size: 16px;
		letter-spacing: 0.04em;
		color: var(--color-ink-dim);
	}
</style>
