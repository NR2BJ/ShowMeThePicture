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
		const camera = v.cameraModel ?? v.roll?.camera ?? null;
		if (camera) parts.push(camera);
		if (v.lens) parts.push(v.lens);
		if (v.roll?.filmStock) parts.push(v.roll.filmStock);
		return parts.join(' · ');
	});
	const q = $derived(`?ctx=${encodeURIComponent(data.ctx)}`);

	// 보기용 회전 (누구나). 관리자는 '방향 저장' 으로 파생본에 굽는다.
	let turns = $state(0);
	let box = $state({ w: 0, h: 0 });
	$effect(() => {
		void data.photo.id;
		turns = 0;
	});
	const fit = $derived.by(() => {
		const v = current;
		if (!v?.width || !v?.height || !box.w || !box.h) return null;
		const odd = turns % 2 === 1;
		const vw0 = odd ? v.height : v.width;
		const vh0 = odd ? v.width : v.height;
		const scale = Math.min(box.w / vw0, box.h / vh0, 1);
		const vw = vw0 * scale;
		const vh = vh0 * scale;
		// img 요소 자체의 크기(회전 전) — 회전 후 보이는 박스가 vw×vh 가 되게
		return { w: odd ? vh : vw, h: odd ? vw : vh };
	});

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
	<figure bind:clientWidth={box.w} bind:clientHeight={box.h}>
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
					style:width={fit ? `${fit.w}px` : undefined}
					style:height={fit ? `${fit.h}px` : undefined}
					style:transform={turns ? `rotate(${turns * 90}deg)` : undefined}
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
			<span class="chips rotate">
				<button
					type="button"
					class="chip"
					onclick={() => (turns = (turns + 3) % 4)}
					title="왼쪽으로 회전"
					aria-label="왼쪽으로 회전">↺</button
				>
				<button
					type="button"
					class="chip"
					onclick={() => (turns = (turns + 1) % 4)}
					title="오른쪽으로 회전"
					aria-label="오른쪽으로 회전">↻</button
				>
				{#if data.admin && turns && current}
					<form method="POST" action="?/rotate">
						<input type="hidden" name="fileId" value={current.id} />
						<input type="hidden" name="rotation" value={(current.rotation + turns) % 4} />
						<button type="submit" class="chip on" title="이 방향으로 파생본을 다시 만듭니다"
							>방향 저장</button
						>
					</form>
				{/if}
			</span>
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
				{#if data.manualCollections.length}
					<form method="POST" action="?/collect" class="collect">
						<select name="collectionId">
							{#each data.manualCollections as mc (mc.id)}<option value={mc.id}>{mc.title}</option
								>{/each}
						</select>
						<button type="submit" class="pill quiet">컬렉션에 추가</button>
					</form>
				{/if}
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
		height: 80vh;
		min-height: 320px;
	}
	figure img {
		max-width: 100%;
		max-height: 100%;
		width: auto;
		height: auto;
		object-fit: contain;
		background: #000;
		opacity: 0;
		transition:
			opacity 0.15s ease,
			transform 0.2s ease;
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
	.collect select {
		background: #141311;
		border: 1px solid var(--color-ink-faint);
		color: var(--color-ink-dim);
		font-family: var(--font-mono);
		font-size: 12px;
		padding: 7px 10px;
		border-radius: 999px;
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
	.chips.rotate .chip {
		font-size: 15px;
		line-height: 1;
		padding: 5px 10px;
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
