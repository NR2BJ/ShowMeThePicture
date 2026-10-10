<script lang="ts">
	import { goto } from '$app/navigation';
	import { fadeIn } from '#lib/actions/fadeIn.ts';
	import GearSelect from '#lib/components/GearSelect.svelte';
	import SpecSheet from '#lib/components/SpecSheet.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let info = $state(false);
	// 장비 수정 폼: 고정렌즈 바디를 고르면 렌즈 칸이 잠긴다
	// svelte-ignore state_referenced_locally
	let ovCamera = $state(data.photo.metaOverride?.camera ?? '');
	$effect(() => {
		ovCamera = data.photo.metaOverride?.camera ?? '';
	});
	const ovCameraOptions = $derived(
		ovCamera && !data.gear.camera.includes(ovCamera)
			? [ovCamera, ...data.gear.camera]
			: data.gear.camera
	);
	const ovLocked = $derived(data.gear.fixedLens[ovCamera] ?? null);
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
		const e = data.photo.effective;
		if (e.camera) parts.push(e.camera);
		if (e.lens) parts.push(e.lens);
		if (e.filmStock) parts.push(e.filmStock);
		return parts.join(' · ');
	});
	const q = $derived(`?ctx=${encodeURIComponent(data.ctx)}`);

	// 보기용 회전 (누구나). variant(원본/보정)마다 따로 기억하고, 각도는 누적값이라 ↺ 는 반시계로 90° 만 돈다.
	let angles: Record<string, number> = $state({});
	let box = $state({ w: 0, h: 0 });
	$effect(() => {
		void data.photo.id;
		angles = {};
	});
	const angle = $derived(current ? (angles[current.id] ?? 0) : 0);
	const turns = $derived((((angle / 90) % 4) + 4) % 4);
	function rotateBy(deg: number) {
		if (!current) return;
		angles = { ...angles, [current.id]: (angles[current.id] ?? 0) + deg };
	}
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
						? `/library/${data.ctx.slice(8)}`
						: data.ctx.startsWith('archive:')
							? `/archive?${data.ctx.slice(8)}`
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
					style:transform={angle ? `rotate(${angle}deg)` : undefined}
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
			{#if data.photo.visibility === 'hidden'}<span class="dim">
					· 숨김</span
				>{/if}{#if data.admin && data.photo.visibilityManual}<span class="dim">
					· 수동 설정</span
				>{/if}
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
					class="chip icon"
					onclick={() => rotateBy(-90)}
					title="왼쪽으로 90° (반시계)"
					aria-label="왼쪽으로 90° 회전"
				>
					<svg
						width="14"
						height="14"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true"
						><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path
							d="M3 3v5h5"
						/></svg
					>
					<span>왼쪽</span>
				</button>
				<button
					type="button"
					class="chip icon"
					onclick={() => rotateBy(90)}
					title="오른쪽으로 90° (시계)"
					aria-label="오른쪽으로 90° 회전"
				>
					<span>오른쪽</span>
					<svg
						width="14"
						height="14"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true"
						><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" /><path
							d="M21 3v5h-5"
						/></svg
					>
				</button>
				{#if data.admin && turns !== 0 && current}
					<form method="POST" action="?/rotate">
						<input type="hidden" name="fileId" value={current.id} />
						<input type="hidden" name="rotation" value={(current.rotation + turns) % 4} />
						<button type="submit" class="chip on" title="이 방향으로 파생본을 다시 만듭니다"
							>이 방향 저장</button
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
				{#if data.photo.visibilityManual}
					<form method="POST" action="?/resetVisibility">
						<button type="submit" class="pill quiet" title="폴더 기본값으로 되돌립니다"
							>기본값으로</button
						>
					</form>
				{/if}
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
			<SpecSheet
				variant={current}
				effective={data.photo.effective}
				showGps={data.showGps}
				admin={data.admin}
			/>
			{#if data.admin}
				<form method="POST" action="?/meta" class="meta-edit">
					<h3>장비 수정 (이 사진만)</h3>
					<label
						><span>카메라</span>
						<select name="camera" bind:value={ovCamera}>
							<option value="">(자동)</option>
							{#each ovCameraOptions as o (o)}<option value={o}>{o}</option>{/each}
						</select></label
					>
					{#if ovLocked}
						<input type="hidden" name="lens" value={ovLocked} />
						<div class="ro">
							<span>렌즈</span><span class="mono dim">{ovLocked}</span>
						</div>
					{:else}
						<label
							><span>렌즈</span><GearSelect
								name="lens"
								value={data.photo.metaOverride?.lens ?? ''}
								options={data.gear.lens}
								placeholder="(자동)"
							/></label
						>
					{/if}
					<label
						><span>필름</span><GearSelect
							name="filmStock"
							value={data.photo.metaOverride?.filmStock ?? ''}
							options={data.gear.film}
							placeholder="(자동)"
						/></label
					>
					<div class="row">
						<button type="submit" class="pill quiet">저장</button>
						{#if data.photo.metaOverride}<button
								type="submit"
								name="clear"
								value="on"
								class="pill quiet">자동으로</button
							>{/if}
						<a href="/admin/gear" class="dim">장비 등록</a>
					</div>
				</form>
			{/if}
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
	.chips.rotate .chip.icon {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 11px;
		padding: 6px 10px;
		text-transform: none;
		letter-spacing: 0.04em;
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
	.meta-edit {
		margin-top: 18px;
		padding-top: 14px;
		border-top: 1px solid var(--color-ink-faint);
		display: grid;
		gap: 8px;
		font-family: var(--font-mono);
		font-size: 12px;
	}
	.meta-edit h3 {
		margin: 0 0 4px;
		font-weight: 500;
		font-size: 10px;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--color-amber);
	}
	.meta-edit label,
	.meta-edit .ro {
		display: grid;
		grid-template-columns: 60px 1fr;
		align-items: center;
		gap: 10px;
		color: var(--color-ink-dim);
	}
	.meta-edit :global(select) {
		background: #141311;
		border: 1px solid var(--color-ink-faint);
		color: var(--color-ink);
		padding: 6px 8px;
		font: inherit;
		border-radius: 2px;
	}
	.meta-edit .row {
		display: flex;
		gap: 8px;
		align-items: center;
		margin-top: 4px;
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
