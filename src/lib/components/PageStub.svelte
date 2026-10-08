<script lang="ts">
	let { title, phase, note = '' }: { title: string; phase: number; note?: string } = $props();
</script>

<section class="stub">
	<h1>{title}</h1>
	<p class="meta">로드맵 {phase}단계에서 구현{note ? ` · ${note}` : ''}</p>
</section>

<style>
	.stub {
		min-height: calc(100dvh - 92px);
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		padding: 0 40px 56px;
	}
	h1 {
		font-family: var(--font-serif);
		font-weight: 400;
		font-size: clamp(44px, 8vw, 120px);
		line-height: 0.95;
		letter-spacing: -0.01em;
		margin: 0 0 18px;
	}
	.meta {
		font-family: var(--font-mono);
		font-size: 14px;
		letter-spacing: 0.06em;
		color: var(--color-ink-dim);
		margin: 0;
	}
	@media (max-width: 720px) {
		.stub {
			padding: 0 20px 40px;
		}
	}
</style>
