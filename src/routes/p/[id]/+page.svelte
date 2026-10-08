<script lang="ts">
	import { goto } from '$app/navigation';
	import { fadeIn } from '#lib/actions/fadeIn.ts';
	import SpecSheet from '#lib/components/SpecSheet.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let info = $state(false);
	let currentId: string | null = $state(null);
	const current = $derived(
		data.photo.variants.find((v) => v.id === currentId) ??
			data.photo.variants.find((v) => v.id === data.photo.primaryFileId) ??
			data.photo.variants[0]
	);
	const original = $derived(
		data.photo.variants.find((v) => v.id === data.photo.originalFileId) ?? null
	);
	const edits = $derived(data.photo.variants.filter((v) => v.role === 'edit'));
	const primaryEdit = $derived(
		data.photo.variants.find((v) => v.id === data.photo.primaryFileId && v.role === 'edit') ??
			edits[0] ??
			null
	);
	const canToggle = $derived(!!original && !!primaryEdit);
	const showingOriginal = $derived(!!original && current?.id === original.id);

	let lastEdit: string | null = $state(null);
	function toggle() {
		if (!canToggle || !original || !current) return;
		if (showingOriginal) currentId = lastEdit ?? primaryEdit!.id;
		else {
			lastEdit = current.id;
			currentId = original.id;
		}
	}
	const dateLine = $derived.by(() => {
		const v = current;
		if (!v) return '';
		const parts: string[] = [];
		if (v.takenAt)
			parts.push(
				new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
					.format(new Date(v.takenAt))
					.replace(/\.\s?/g, '.')
					.replace(/\.$/, '')
			);
		if (v.cameraModel) parts.push(v.cameraModel);
		if (v.lens) parts.push(v.lens);
		return parts.join(' · ');
	});
	const q = $derived(`?ctx=${encodeURIComponent(data.ctx)}`);

	function onKey(e: KeyboardEvent) {
		if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
		if (e.key === 'ArrowLeft' && data.nav.prev) goto(`/p/${data.nav.prev}${q}`);
		else if (e.key === 'ArrowRight' && data.nav.next) goto(`/p/${data.nav.next}${q}`);
		else if (e.key === '\\') toggle();
		else if (e.key === 'i') info = !info;
		else if (e.key === 'Escape') {
			if (info) info = false;
			else
				goto(
					data.ctx.startsWith('library:')
						? `/library/${data.ctx.slice(8).replace(/:b$/, '')}`
						: data.ctx.endsWith(':b')
							? '/archive?b=1'
							: '/archive'
				);
		}
	}
</script>

<svelte:window onkeydown={onKey} />

<svelte:head>
	<title>{data.photo.title ?? current?.filename ?? '사진'}</title>
	{#if current}<meta property="og:image" content={current.urls.preview} />{/if}
</svelte:head>

<main class="photo" class:info>
	<figure>
		{#if data.nav.prev}<a class="arrow prev" href={`/p/${data.nav.prev}${q}`} aria-label="이전 사진"
				>←</a
			>{/if}
		{#key current?.id}
			{#if current}
				<img
					src={current.urls.full}
					alt={data.photo.title ?? ''}
					width={current.width ?? undefined}
					height={current.height ?? undefined}
					use:fadeIn
				/>
			{/if}
		{/key}
		{#if data.nav.next}<a class="arrow next" href={`/p/${data.nav.next}${q}`} aria-label="다음 사진"
				>→</a
			>{/if}
	</figure>

	<div class="bar">
		<p class="line mono">
			{dateLine}
			{#if data.photo.tier}<span class="dim"> · {data.photo.tier}컷</span>{/if}
			{#if data.photo.visibility === 'hidden'}<span class="dim"> · 숨김</span>{/if}
		</p>
		<div class="controls">
			{#if canToggle}
				<button type="button" class="pill" onclick={toggle} title="\\ 키"
					>{showingOriginal ? '보정 보기' : '원본 보기'}</button
				>
			{/if}
			{#if data.photo.variants.length > 1}
				<span class="chips">
					{#each data.photo.variants as v (v.id)}
						<button
							type="button"
							class="chip"
							class:on={current?.id === v.id}
							onclick={() => (currentId = v.id)}
							>{v.role === 'edit' ? (v.label ?? '기본') : (v.label ?? v.ext.toUpperCase())}</button
						>
					{/each}
				</span>
			{/if}
			<button type="button" class="pill quiet" onclick={() => (info = !info)} title="i 키"
				>{info ? '닫기' : '정보'}</button
			>
			{#if data.admin}
				<form method="POST" action="?/visibility">
					<input
						type="hidden"
						name="visibility"
						value={data.photo.visibility === 'public' ? 'hidden' : 'public'}
					/>
					<button type="submit" class="pill quiet"
						>{data.photo.visibility === 'public' ? '숨기기' : '공개하기'}</button
					>
				</form>
				{#if current}<a
						class="pill quiet"
						href={`/media/${current.id}/original`}
						target="_blank"
						rel="noopener">원본 파일</a
					>{/if}
			{/if}
		</div>
	</div>

	{#if info && current}
		<aside class="drawer">
			<SpecSheet variant={current} showGps={data.showGps} admin={data.admin} />
		</aside>
	{/if}
</main>

<style>
	.photo {
		min-height: calc(100dvh - 92px);
		display: grid;
		grid-template-rows: 1fr auto;
		grid-template-columns: 1fr;
		padding: 0 40px 28px;
		gap: 16px;
	}
	.photo.info {
		grid-template-columns: 1fr 380px;
	}
	figure {
		position: relative;
		margin: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 60vh;
	}
	figure img {
		max-width: 100%;
		max-height: 80vh;
		width: auto;
		height: auto;
		object-fit: contain;
		background: #000;
		opacity: 0;
		transition: opacity 0.15s ease;
	}
	figure img:global(.loaded) {
		opacity: 1;
	}
	.arrow {
		position: absolute;
		top: 50%;
		transform: translateY(-50%);
		font-family: var(--font-serif);
		font-size: 28px;
		color: var(--color-ink-dim);
		opacity: 0;
		transition: opacity 0.2s;
		padding: 20px;
	}
	.arrow.prev {
		left: -20px;
	}
	.arrow.next {
		right: -20px;
	}
	figure:hover .arrow {
		opacity: 1;
	}
	.bar {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 20px;
		flex-wrap: wrap;
	}
	.line {
		margin: 0;
		font-size: 14px;
		letter-spacing: 0.06em;
	}
	.controls {
		display: flex;
		gap: 8px;
		align-items: center;
		flex-wrap: wrap;
	}
	.controls form {
		display: contents;
	}
	.pill,
	.chip {
		font-family: var(--font-mono);
		font-size: 13px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		padding: 8px 16px;
		border-radius: 999px;
		border: 1px solid var(--color-ink);
		background: transparent;
		color: var(--color-ink);
		cursor: pointer;
	}
	.pill:hover {
		background: var(--color-ink);
		color: var(--color-bg);
	}
	.pill.quiet {
		border-color: var(--color-ink-faint);
		color: var(--color-ink-dim);
	}
	.pill.quiet:hover {
		background: transparent;
		color: var(--color-ink);
		border-color: var(--color-ink);
	}
	.chips {
		display: inline-flex;
		gap: 4px;
	}
	.chip {
		border-color: var(--color-ink-faint);
		color: var(--color-ink-dim);
		padding: 7px 12px;
	}
	.chip.on {
		border-color: var(--color-amber);
		color: var(--color-amber);
	}
	.drawer {
		grid-column: 2;
		grid-row: 1 / span 2;
		border-left: 1px solid var(--color-ink-faint);
		padding: 8px 0 0 24px;
		max-height: calc(100dvh - 120px);
		overflow: auto;
	}
	@media (max-width: 900px) {
		.photo,
		.photo.info {
			grid-template-columns: 1fr;
			padding: 0 16px 24px;
		}
		.drawer {
			grid-column: 1;
			grid-row: auto;
			border-left: 0;
			border-top: 1px solid var(--color-ink-faint);
			padding: 16px 0 0;
			max-height: none;
		}
		.arrow {
			display: none;
		}
	}
</style>
