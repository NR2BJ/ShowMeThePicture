<script lang="ts">
	import { fadeIn } from '#lib/actions/fadeIn.ts';
	import type { StripRow } from '#lib/types.ts';

	let { rows }: { rows: StripRow[] } = $props();
</script>

<div class="strips" aria-label="무작위 사진 필름 스트립">
	{#each rows as row, r (r)}
		<section class="strip" data-dir={row.dir} style:--dur="{row.dur}s" style:--tilt="{row.tilt}deg">
			<div class="track">
				<!-- 끊김 없는 루프를 위해 같은 프레임을 두 번 -->
				{#each [0, 1] as copy (copy)}
					{#each row.frames as f, i (`${copy}-${i}-${f.id}`)}
						<a
							class="frame"
							href={f.src ? `/p/${f.id}` : undefined}
							aria-hidden={copy === 1 ? 'true' : undefined}
							tabindex={copy === 1 || !f.src ? -1 : undefined}
						>
							{#if f.src}
								<img
									src={f.src}
									alt=""
									loading={copy === 0 && i < 8 ? 'eager' : 'lazy'}
									use:fadeIn
								/>
							{/if}
							<span class="rt">{f.label}</span>
							<span class="rb">{f.num}</span>
						</a>
					{/each}
				{/each}
			</div>
		</section>
	{/each}
</div>

<style>
	.strips {
		--fh: clamp(110px, 21vh, 210px);
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: clamp(14px, 3.6vh, 36px);
		height: 100%;
	}
	.strip {
		width: 120vw;
		margin-left: -10vw;
		overflow: hidden;
		transform: rotate(var(--tilt, 0deg));
	}
	.track {
		position: relative;
		display: flex;
		gap: 10px;
		width: max-content;
		padding: 28px 0;
		background: var(--color-base);
		animation: scroll var(--dur, 90s) linear infinite;
	}
	.strip[data-dir='right'] .track {
		animation-direction: reverse;
	}
	.strip:hover .track {
		animation-play-state: paused;
	}
	@keyframes scroll {
		to {
			transform: translateX(-50%);
		}
	}
	/* 스프로켓 구멍: 베이스 위에 바탕색 사각형 반복 */
	.track::before,
	.track::after {
		content: '';
		position: absolute;
		left: 0;
		right: 0;
		height: 8px;
		background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='34' height='8'%3E%3Crect x='11' y='0' width='12' height='8' rx='1.5' fill='%230b0b0a'/%3E%3C/svg%3E")
			repeat-x;
	}
	.track::before {
		top: 6px;
	}
	.track::after {
		bottom: 6px;
	}
	.frame {
		position: relative;
		display: block;
		flex: none;
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
		font-size: 10px;
		line-height: 11px;
		font-weight: 500;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--color-amber);
		opacity: 0.9;
	}
	.rt {
		top: -15px;
		left: 1px;
	}
	.rb {
		bottom: -15px;
		right: 1px;
	}
	.rb::before {
		content: '▸ ';
		opacity: 0.6;
	}
	@media (prefers-reduced-motion: reduce) {
		.track {
			animation: none;
		}
	}
	@media (max-width: 720px) {
		.strips {
			--fh: 96px;
		}
		.strip:nth-child(3) {
			display: none;
		}
	}
</style>
