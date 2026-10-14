<script lang="ts">
	// 랜딩 필름 스트립. 긴 띠 하나를 통째로 움직이지 않고, 화면을 덮을 만큼의 칸만 만들어 칸마다 따로 움직인다.
	// 왼쪽(또는 오른쪽) 끝으로 나간 칸은 화면 밖에서 반대쪽 끝으로 옮기며 다음 사진으로 바꿔 낀다.
	// (예전 방식은 폰에서 수천 px 짜리 움직이는 레이어가 생겨 아이폰 Safari 가 일부를 그리지 않았다 — 가운데 줄이 비고,
	//  시간이 지나면 사진이 끊겼다)
	import { onMount } from 'svelte';
	import { fadeIn } from '#lib/actions/fadeIn.ts';
	import type { StripRow } from '#lib/types.ts';

	// frameVh: 프레임 높이(화면 높이 %), 관리자 설정값
	// ctx: 사진 페이지가 이전/다음을 랜딩에 나오는 컷끼리 넘기게
	let {
		rows,
		frameVh = 21,
		ctx = 'landing:kind=A'
	}: { rows: StripRow[]; frameVh?: number; ctx?: string } = $props();

	/** 속도: dur 초에 14칸 — 예전 띠 방식과 비슷 */
	const STEPS_PER_LOOP = 14;
	const mod = (a: number, n: number) => ((a % n) + n) % n;

	// 칸 수: 줄 폭을 덮고 양옆에 한 칸씩 여유. 마운트 전(SSR)에는 넉넉히.
	let slotCount = $state(12);
	// 줄마다 칸별로 보여 줄 사진 번호
	let idx = $state<number[][]>([]);
	$effect.pre(() => {
		idx = rows.map((r) =>
			Array.from({ length: slotCount }, (_, j) => mod(j, Math.max(1, r.frames.length)))
		);
	});
	let paused = $state<boolean[]>([]);
	// 프레임 높이(--fh, 아래 CSS): 가로 화면은 설정값(화면 높이 %), 세로 화면은 줄 수만큼 화면 높이를 채우는 크기(--fill).
	// 둘 다 화면 폭 상한(--wcap)을 넘지 않는다 — 폰에서 한 줄에 프레임이 너무 적어지지 않게.
	// 예전엔 세로 태블릿에서도 설정값·폭 상한에 묶여 프레임이 작고 위아래가 크게 비었다.
	// 116px = 랜딩 위아래 여백(72+36) + 기울기 여유
	const fill = $derived(
		`calc((100dvh - 116px - ${Math.max(0, rows.length - 1)} * clamp(10px, 2.2vh, 56px)) / ${Math.max(1, rows.length)} - 2 * var(--pad))`
	);
	let root: HTMLDivElement | undefined = $state();

	onMount(() => {
		const el = root;
		if (!el) return;
		const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
		const dpr = window.devicePixelRatio || 1;
		let stepPx = 0;
		const measure = () => {
			const cell = el.querySelector<HTMLElement>('.cell');
			const strip = el.querySelector<HTMLElement>('.strip');
			if (!cell || !strip || cell.offsetWidth === 0) return;
			// 칸 폭을 기기 픽셀에 맞춘다 — 칸끼리 정확히 맞물려 틈·겹침(구멍 띠의 하얀 잔상)이 없게
			el.style.removeProperty('--step-px');
			const w = parseFloat(getComputedStyle(cell).width);
			stepPx = Math.round(w * dpr) / dpr;
			el.style.setProperty('--step-px', `${stepPx}px`);
			const n = Math.ceil(strip.offsetWidth / cell.offsetWidth) + 2;
			if (n !== slotCount) slotCount = n;
		};
		measure();
		const ro = new ResizeObserver(measure);
		ro.observe(el);

		// 줄마다 진행량(칸 단위). 처음엔 줄마다 조금씩 어긋나게.
		const offset = rows.map((_, r) => (r * 0.37) % 1);
		const cycles: number[][] = [];
		let last = performance.now();
		let raf = 0;
		const tick = (now: number) => {
			const dt = Math.min(0.1, (now - last) / 1000); // 탭이 숨었다 돌아와도 한 번에 튀지 않게
			last = now;
			const S = slotCount;
			const strips = el.querySelectorAll<HTMLElement>('.strip');
			rows.forEach((row, r) => {
				const n = Math.max(1, row.frames.length);
				if (!reduce && !paused[r]) {
					offset[r] += (row.dir === 'left' ? 1 : -1) * (STEPS_PER_LOOP / row.dur) * dt;
				}
				const cells = strips[r]?.querySelectorAll<HTMLElement>('.cell');
				if (!cells) return;
				cycles[r] ??= [];
				for (let j = 0; j < Math.min(S, cells.length); j++) {
					const p = j - offset[r];
					const c = Math.floor(p / S);
					// 칸 위치(칸 단위, 왼쪽 밖 한 칸부터). 끝에서 끝으로 옮겨지는 순간은 화면 밖이다.
					const x = p - c * S - 1;
					// 기기 픽셀에 맞춰 반올림 — 소수 픽셀로 움직이면 구멍 띠에 하얀 잔상이 끌리듯 보일 때가 있었다
					if (stepPx)
						cells[j].style.transform = `translate3d(${Math.round(x * stepPx * dpr) / dpr}px, 0, 0)`;
					else cells[j].style.setProperty('--x', String(x));
					if (cycles[r][j] !== c) {
						cycles[r][j] = c;
						const next = mod(j - c * S, n);
						if (idx[r] && idx[r][j] !== next) idx[r][j] = next;
					}
				}
			});
			raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		return () => {
			cancelAnimationFrame(raf);
			ro.disconnect();
		};
	});
</script>

<div
	class="strips"
	bind:this={root}
	aria-label="무작위 사진 필름 스트립"
	style:--fv={frameVh}
	style:--fill={fill}
>
	{#each rows as row, r (r)}
		<!-- 마우스를 올린 동안, 또는 손가락으로 누르고 있는 동안 그 줄만 멈춘다 (손을 떼거나 제스처가 취소되면 다시 흐름) -->
		<section
			class="strip"
			role="group"
			style:--tilt="{row.tilt}deg"
			onpointerenter={(e) => e.pointerType === 'mouse' && (paused[r] = true)}
			onpointerleave={(e) => e.pointerType === 'mouse' && (paused[r] = false)}
			onpointerdown={(e) => e.pointerType !== 'mouse' && (paused[r] = true)}
			onpointerup={(e) => e.pointerType !== 'mouse' && (paused[r] = false)}
			onpointercancel={() => (paused[r] = false)}
		>
			{#each { length: slotCount } as _, j (j)}
				{@const f = row.frames[idx[r]?.[j] ?? mod(j, Math.max(1, row.frames.length))]}
				<div class="cell" style:--x={j - 1}>
					{#if f}
						<a
							class="frame"
							href={f.src ? `/p/${f.id}?ctx=${encodeURIComponent(ctx)}` : undefined}
							tabindex={f.src ? undefined : -1}
						>
							{#if f.src}
								<img src={f.src} alt="" loading="eager" decoding="async" use:fadeIn />
							{/if}
							<span class="rt">{f.label}</span>
							<span class="rb">{f.num}</span>
						</a>
					{/if}
				</div>
			{/each}
		</section>
	{/each}
</div>

<style>
	/* 크기는 화면 높이에 비례(폰처럼 세로로 긴 화면은 너비 상한) — 4K 에서도 얇지 않고, 작은 창에서도 여러 줄이 들어간다 */
	.strips {
		/* 프레임 높이 (위 스크립트 주석 참고) */
		--wcap: calc(var(--fv) * 1.4vw);
		--fh: clamp(40px, min(calc(var(--fv) * 1vh), var(--wcap), var(--fill)), 960px);
		--hole: clamp(6px, 0.75vh, 16px);
		/* 정수 px 로 — 소수 높이면 구멍 가장자리가 반 픽셀로 번져 띠에 옅은 선이 보였다 */
		--hole: round(clamp(6px, 0.75vh, 16px), 1px);
		--lab: clamp(11px, 1vh, 20px);
		--gap: clamp(8px, 0.9vh, 20px);
		/* 각인 글자가 구멍 띠와 겹치지 않도록 띠 + 글자 + 여유 */
		--pad: clamp(18px, 3vh, 64px);
		--step: calc(var(--fh) * 1.5 + var(--gap));
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: clamp(10px, 2.2vh, 56px);
		height: 100%;
	}
	/* 폰보다 넓으면 폭 상한을 풀어 준다 */
	@media (min-width: 600px) {
		.strips {
			--wcap: calc(var(--fv) * 2vw);
		}
	}
	/* 세로로 긴 화면(태블릿·폰 세로): 설정값 대신 화면을 채우는 크기 */
	@media (orientation: portrait) {
		.strips {
			--fh: clamp(40px, min(var(--wcap), var(--fill)), 960px);
		}
	}
	.strip {
		position: relative;
		flex: none;
		width: 120vw;
		margin-left: -10vw;
		height: calc(var(--fh) + var(--pad) * 2);
		transform: rotate(var(--tilt, 0deg));
		/* 넘치는 칸은 페이지(.landing)가 자른다 — 기울인 요소에 overflow 를 걸지 않는다 */
	}
	/* 한 칸 = 필름 베이스 + 위아래 구멍 + 프레임. 칸끼리 붙어서 한 띠처럼 보인다 */
	.cell {
		position: absolute;
		top: 0;
		left: 0;
		width: var(--step-px, var(--step));
		height: 100%;
		background: var(--color-base);
		transform: translate3d(calc(var(--x) * var(--step)), 0, 0);
		will-change: transform;
	}
	.cell::before,
	.cell::after {
		content: '';
		position: absolute;
		left: 0;
		right: 0;
		height: var(--hole);
		/* 구멍은 그라디언트로(칸 1/6 폭 중 가운데 12/34). 예전 SVG 그림을 소수 크기로 늘려 반복하면, 회전한 띠에서
		   그림 가장자리가 번져 구멍 줄 밑에 옅은(하얀) 선 조각이 보였다(안드로이드 태블릿) */
		background: linear-gradient(
				90deg,
				transparent 32.35%,
				#0b0b0a 32.35%,
				#0b0b0a 67.65%,
				transparent 67.65%
			)
			repeat-x;
		/* 칸 폭을 구멍 6개로 나눠 칸 경계에서도 간격이 이어지게 */
		background-size: calc(var(--step-px, var(--step)) / 6) var(--hole);
	}
	.cell::before {
		top: calc(var(--hole) * 0.75);
	}
	.cell::after {
		bottom: calc(var(--hole) * 0.75);
	}
	.frame {
		position: absolute;
		z-index: 1;
		top: var(--pad);
		left: calc(var(--gap) / 2);
		display: block;
		height: var(--fh);
		aspect-ratio: 3 / 2;
		background: #000;
	}
	.frame img {
		width: 100%;
		height: 100%;
		object-fit: contain; /* 크롭된 사진은 검정 여백 */
		display: block;
		opacity: 0;
		transition: opacity 0.7s ease;
	}
	.frame img:global(.loaded) {
		opacity: 1;
	}
	.frame:hover img {
		opacity: 0.92;
	}
	/* 가장자리 각인: 실제 메타데이터 */
	.rt,
	.rb {
		position: absolute;
		white-space: nowrap;
		pointer-events: none;
		font-family: var(--font-mono);
		font-size: var(--lab);
		line-height: 1.1;
		font-weight: 500;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--color-amber);
		opacity: 0.9;
	}
	.rt {
		top: calc(var(--lab) * -1.35);
		left: 1px;
	}
	.rb {
		bottom: calc(var(--lab) * -1.35);
		right: 1px;
	}
	.rb::before {
		content: '▸ ';
		opacity: 0.6;
	}
</style>
