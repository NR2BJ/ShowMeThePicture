<script lang="ts">
	import { enhance, type SubmitFunction } from '$app/forms';
	import { beforeNavigate, goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { markChanged } from '#lib/changed.ts';
	import { countPhotoView } from '#lib/visit.ts';
	import { fadeIn } from '#lib/actions/fadeIn.ts';
	import GearSelect from '#lib/components/GearSelect.svelte';
	import PhotoGrid from '#lib/components/PhotoGrid.svelte';
	import SpecSheet from '#lib/components/SpecSheet.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let info = $state(false);
	// 조회수: 손님이 이 사진을 화면에 띄워 둔 채 2초 머물면 한 번 (사진마다 하루 한 번). 숫자는 관리자만 본다.
	$effect(() => {
		if (data.admin) return;
		return countPhotoView(data.photo.id);
	});
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
	const dateParts = $derived.by(() => {
		const v = current;
		if (!v) return [] as string[];
		const parts: string[] = [];
		if (v.takenAt) {
			const d = Object.fromEntries(
				new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' })
					.formatToParts(new Date(v.takenAt))
					.map((x) => [x.type, x.value])
			);
			// 필름은 날짜가 롤(현상월)에서 온 값이라 일(日)은 의미가 없다 — 연·월만
			parts.push(
				data.photo.medium === 'film' ? `${d.year}.${d.month}` : `${d.year}.${d.month}.${d.day}`
			);
		}
		const e = data.photo.effective;
		if (e.camera) parts.push(e.camera);
		if (e.lens) parts.push(e.lens);
		if (e.filmStock) parts.push(e.filmStock);
		return parts;
	});
	// 날짜 줄 뒤에 흐리게: 컷·숨김·수동·조회 (컷·수동·조회는 관리자만)
	const metaParts = $derived(
		[
			data.admin && data.photo.tier
				? `${data.photo.tier}컷${data.photo.tierManual ? '(직접)' : ''}`
				: null,
			data.photo.visibility === 'hidden' ? '숨김' : null,
			data.admin && data.photo.visibilityManual ? '수동 설정' : null,
			data.views
				? `조회 ${data.views.total}${data.views.today ? ` (오늘 ${data.views.today})` : ''}`
				: null
		].filter((x): x is string => !!x)
	);
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
	// 관리자는 돌리면 바로 저장(마지막으로 누르고 0.7초 뒤 한 번 — 저장마다 파생본을 다시 만들므로), 손님은 보기만 돈다
	const SAVE_DELAY = 700;
	let saveTimer: ReturnType<typeof setTimeout> | null = null;
	let rotSaving = $state(false);
	function rotateBy(deg: number) {
		if (!current || rotSaving) return;
		angles = { ...angles, [current.id]: (angles[current.id] ?? 0) + deg };
		if (data.admin) {
			if (saveTimer) clearTimeout(saveTimer);
			saveTimer = setTimeout(() => {
				saveTimer = null;
				void saveRotation();
			}, SAVE_DELAY);
		}
	}
	// 방향 저장 중에는 돌려 놓은 화면을 그대로 둔다(frozen) — 새 파생본(이미 돌아간 이미지)이 다 받아지면
	// 애니메이션 없이(noAnim) 바꿔 끼운다. 예전엔 보기 각도가 0 으로 돌아가는 회전 애니메이션이 보였다.
	type View = {
		id: string;
		src: string;
		width: number | null;
		height: number | null;
		angle: number;
	};
	let frozen = $state<View | null>(null);
	let noAnim = $state(false);
	const view = $derived<View | null>(
		current
			? frozen && frozen.id === current.id
				? frozen
				: {
						id: current.id,
						src: current.urls.full,
						width: current.width,
						height: current.height,
						angle
					}
			: null
	);
	const viewTurns = $derived(view ? (((view.angle / 90) % 4) + 4) % 4 : 0);
	const fit = $derived.by(() => {
		const v = view;
		if (!v?.width || !v?.height || !box.w || !box.h) return null;
		const odd = viewTurns % 2 === 1;
		const vw0 = odd ? v.height : v.width;
		const vh0 = odd ? v.width : v.height;
		const scale = Math.min(box.w / vw0, box.h / vh0, 1);
		const vw = vw0 * scale;
		const vh = vh0 * scale;
		// img 요소 자체의 크기(회전 전) — 회전 후 보이는 박스가 vw×vh 가 되게
		return { w: odd ? vh : vw, h: odd ? vw : vh };
	});

	// 폰·태블릿: 사진을 좌우로 밀어 이전/다음. 손가락이 처음 몇 px 움직일 때 방향을 정하고, 가로면 페이지 스크롤을 막고
	// 사진이 손가락을 따라온다(세로면 그냥 스크롤). 예전엔 손을 뗀 뒤에야 판단해 그사이 페이지가 위아래로 움직였다.
	let dragX = $state(0);
	let dragging = $state(false);
	function swipe(node: HTMLElement) {
		let sx = 0;
		let sy = 0;
		let axis: 'x' | 'y' | null = null;
		let active = false;
		const reset = () => {
			active = false;
			dragging = false;
			dragX = 0;
		};
		const start = (e: TouchEvent) => {
			if (e.touches.length !== 1) return reset();
			active = true;
			axis = null;
			sx = e.touches[0].clientX;
			sy = e.touches[0].clientY;
		};
		const move = (e: TouchEvent) => {
			if (!active || e.touches.length !== 1) return;
			const dx = e.touches[0].clientX - sx;
			const dy = e.touches[0].clientY - sy;
			if (!axis) {
				if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
				axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
			}
			if (axis !== 'x') return;
			e.preventDefault();
			dragging = true;
			// 더 넘길 사진이 없는 쪽은 살짝만 끌린다
			const blocked = (dx > 0 && !data.nav.prev) || (dx < 0 && !data.nav.next);
			dragX = blocked ? dx * 0.25 : dx;
		};
		const end = (e: TouchEvent) => {
			if (!active) return;
			const wasX = axis === 'x';
			const dx = e.changedTouches[0].clientX - sx;
			reset();
			if (!wasX) return;
			const to = dx > 0 ? data.nav.prev : data.nav.next;
			if (to && Math.abs(dx) > Math.min(80, node.clientWidth * 0.18))
				goto(`/p/${to}${q}`, { replace: true });
		};
		node.addEventListener('touchstart', start, { passive: true });
		node.addEventListener('touchmove', move, { passive: false });
		node.addEventListener('touchend', end);
		node.addEventListener('touchcancel', reset);
		return {
			destroy() {
				node.removeEventListener('touchstart', start);
				node.removeEventListener('touchmove', move);
				node.removeEventListener('touchend', end);
				node.removeEventListener('touchcancel', reset);
			}
		};
	}

	// 관리자 버튼은 페이지를 새로 불러오지 않고 처리한다 — 새로 불러오면 주소의 ctx 가 빠져 이전/다음이 아카이브 전체로 바뀌었다
	// 처리 주소에도 ctx 를 붙인다 — 처리 뒤 주소가 이 주소 기준으로 다시 잡힌다
	// 주소에 ctx 가 없었으면 붙이지 않는다 — 붙이면 처리 뒤 주소가 바뀌며 방문 기록이 한 칸 늘어 뒤로 가기를 두 번 눌러야 했다
	const urlCtx = $derived(page.url.searchParams.get('ctx'));
	const act = $derived(urlCtx ? `&ctx=${encodeURIComponent(urlCtx)}` : '');
	const keep: SubmitFunction =
		() =>
		async ({ update, result }) => {
			if (result.type === 'success') markChanged(data.photo.id);
			await update({ reset: false });
		};
	async function postRotation(fileId: string, rotation: number) {
		const fd = new FormData();
		fd.set('fileId', fileId);
		fd.set('rotation', String(rotation));
		await fetch(`?/rotate${act}`, {
			method: 'POST',
			body: fd,
			headers: { 'x-sveltekit-action': 'true' }
		});
	}
	async function saveRotation() {
		const c = current;
		if (!c) return;
		const t = turns;
		if (t === 0) {
			angles[c.id] = 0; // 한 바퀴 돌아 제자리면 저장할 것 없음
			return;
		}
		rotSaving = true;
		if (view) frozen = { ...view }; // 저장하는 동안 돌려 놓은 화면 그대로
		try {
			await postRotation(c.id, (c.rotation + t) % 4);
			markChanged(data.photo.id);
			await invalidateAll();
			const n = current;
			if (n && n.id === c.id) {
				// 새 파생본을 미리 받아 둔 뒤 한 번에 바꾼다: 이미지 교체 + 보기 회전 0, 둘 다 애니메이션 없이
				const img = new Image();
				img.src = n.urls.full;
				await img.decode().catch(() => {});
			}
			noAnim = true;
			angles[c.id] = 0;
			requestAnimationFrame(() => requestAnimationFrame(() => (noAnim = false)));
		} finally {
			frozen = null;
			rotSaving = false;
		}
	}
	// 저장 대기 중에 다른 사진으로 넘어가면 그 자리에서 저장
	beforeNavigate(() => {
		if (!saveTimer || !current) return;
		clearTimeout(saveTimer);
		saveTimer = null;
		if (turns !== 0) {
			void postRotation(current.id, (current.rotation + turns) % 4);
			markChanged(data.photo.id);
		}
	});

	function onKey(e: KeyboardEvent) {
		if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
		if (e.key === 'ArrowLeft' && data.nav.prev) goto(`/p/${data.nav.prev}${q}`, { replace: true });
		else if (e.key === 'ArrowRight' && data.nav.next)
			goto(`/p/${data.nav.next}${q}`, { replace: true });
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
							: data.ctx.startsWith('search:')
								? `/search?${data.ctx.slice(7)}`
								: data.ctx.startsWith('landing:')
									? '/'
									: data.ctx === 'manual'
										? '/admin/visibility'
										: '/archive'
				);
		}
	}
</script>

<svelte:window onkeydown={onKey} />

<main class="photo" class:info class:admin={!!data.admin}>
	<!-- 넘기기는 방문 기록을 쌓지 않는다(replacestate) — 뒤로 가기 한 번이면 목록으로 -->
	<figure use:swipe>
		{#if data.nav.prev}<a
				class="arrow prev"
				href={`/p/${data.nav.prev}${q}`}
				data-sveltekit-replacestate
				aria-label="이전 사진">←</a
			>{/if}
		<div
			class="stage"
			class:dragging
			bind:clientWidth={box.w}
			bind:clientHeight={box.h}
			style:transform={dragX ? `translateX(${dragX}px)` : undefined}
		>
			{#key current?.id}
				{#if current}
					<img
						src={view?.src ?? current.urls.full}
						alt={data.photo.title ?? ''}
						width={view?.width ?? undefined}
						height={view?.height ?? undefined}
						class:no-anim={noAnim}
						style:width={fit ? `${fit.w}px` : undefined}
						style:height={fit ? `${fit.h}px` : undefined}
						style:transform={view?.angle ? `rotate(${view.angle}deg)` : undefined}
						use:fadeIn
					/>
				{/if}
			{/key}
		</div>
		{#if data.nav.next}<a
				class="arrow next"
				href={`/p/${data.nav.next}${q}`}
				data-sveltekit-replacestate
				aria-label="다음 사진">→</a
			>{/if}
	</figure>

	<!-- 사진 바로 밑에 모은다: 날짜·장비 한 줄, 그 밑에 보기 도구(누구나) | 관리 도구(관리자).
	     컴퓨터는 가운데 정렬(사진도 가운데) — 예전엔 날짜는 왼쪽 끝, 버튼은 오른쪽 끝, 관리는 왼쪽 아래라 눈·마우스가 오갔다.
	     폰은 왼쪽 정렬로 줄마다 쌓는다. 관리 도구는 구분선으로 나눠 어떤 버튼이 무엇을 바꾸는지 헷갈리지 않게. -->
	<div class="bar">
		<p class="line mono">
			{#each [...dateParts.map( (t) => ({ t, dim: false }) ), ...metaParts.map( (t) => ({ t, dim: true }) )] as p, i (i)}<span
					class="part"
					class:dim={p.dim}>{p.t}</span
				>{' '}{/each}
		</p>
		<div class="toolbar">
			<div class="tools" role="toolbar" aria-label="보기">
				{#if data.photo.variants.length > 1}
					<span class="seg" role="group" aria-label="파일">
						{#each data.photo.variants as v (v.id)}
							<button
								type="button"
								class="tb"
								class:on={current?.id === v.id}
								aria-pressed={current?.id === v.id}
								title={canToggle ? '\\ 키: 원본 ↔ 보정' : undefined}
								onclick={() => (currentId = v.id)}
								>{v.role === 'edit'
									? (v.label ?? '기본')
									: (v.label ?? v.ext.toUpperCase())}</button
							>
						{/each}
					</span>
				{/if}
				<span class="seg" role="group" aria-label="회전">
					<button
						type="button"
						class="tb icon"
						onclick={() => rotateBy(-90)}
						disabled={rotSaving}
						title={data.admin ? '왼쪽으로 90° · 바로 저장' : '왼쪽으로 90° · 보기만'}
						aria-label="왼쪽으로 90° 회전"
					>
						<svg
							width="16"
							height="16"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="1.8"
							stroke-linecap="round"
							stroke-linejoin="round"
							aria-hidden="true"
							><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path
								d="M3 3v5h5"
							/></svg
						>
					</button>
					<button
						type="button"
						class="tb icon"
						onclick={() => rotateBy(90)}
						disabled={rotSaving}
						title={data.admin ? '오른쪽으로 90° · 바로 저장' : '오른쪽으로 90° · 보기만'}
						aria-label="오른쪽으로 90° 회전"
					>
						<svg
							width="16"
							height="16"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="1.8"
							stroke-linecap="round"
							stroke-linejoin="round"
							aria-hidden="true"
							><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" /><path
								d="M21 3v5h-5"
							/></svg
						>
					</button>
				</span>
				<button
					type="button"
					class="tb info-btn"
					class:on={info}
					aria-expanded={info}
					onclick={() => (info = !info)}
					title="i 키">{info ? '닫기' : '정보'}</button
				>
			</div>

			{#if data.admin}
				<div class="admin-tools" role="toolbar" aria-label="관리">
					<span class="lbl mono">관리</span>
					<form use:enhance={keep} method="POST" action={`?/visibility${act}`}>
						<input
							type="hidden"
							name="visibility"
							value={data.photo.visibility === 'public' ? 'hidden' : 'public'}
						/>
						<!-- 폭 고정: 숨기기 ↔ 공개하기 를 눌러도 옆 버튼이 밀리지 않게 -->
						<button type="submit" class="tb same-width"
							>{data.photo.visibility === 'public' ? '숨기기' : '공개하기'}</button
						>
					</form>
					<!-- 컷 직접 정하기: 원본 폴더의 필름 스캔·카메라 JPG 도 A/B 로 올릴 수 있다 -->
					<form
						use:enhance={keep}
						method="POST"
						action={`?/tier${act}`}
						class="seg"
						aria-label="컷"
					>
						{#each [['A', 'A컷'], ['B', 'B컷'], ['', '없음']] as [t, label] (t)}
							<button
								type="submit"
								name="tier"
								value={t}
								class="tb"
								class:on={(data.photo.tier ?? '') === t}
								aria-pressed={(data.photo.tier ?? '') === t}
								title={t ? `${label}으로 (숨김이면 공개로 바뀜)` : '컷 표시를 뺍니다'}
								>{label}</button
							>
						{/each}
					</form>
					<!-- 되돌리기(공개 기본값·컷 자동)는 관리자 '직접 바꾼 사진' 페이지에서 — 여기서 버튼이 생겼다 사라지면 다른 버튼 위치가 바뀐다 -->
					{#if current}<a
							class="tb"
							href={`/media/${current.id}/original`}
							target="_blank"
							rel="noopener">원본 파일</a
						>{/if}
					{#if data.manualCollections.length}
						<form use:enhance={keep} method="POST" action={`?/collect${act}`} class="seg collect">
							<select name="collectionId" class="tb" aria-label="컬렉션">
								{#each data.manualCollections as mc (mc.id)}<option value={mc.id}>{mc.title}</option
									>{/each}
							</select>
							<button type="submit" class="tb">컬렉션에 추가</button>
						</form>
					{/if}
				</div>
			{/if}
		</div>
	</div>

	{#if info && current}
		<aside class="drawer">
			<SpecSheet
				variant={current}
				effective={data.photo.effective}
				film={data.photo.medium === 'film'}
				showGps={data.showGps}
				admin={data.admin}
			/>
			{#if data.admin}
				<form use:enhance={keep} method="POST" action={`?/meta${act}`} class="meta-edit">
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
						<button type="submit" class="tb">저장</button>
						{#if data.photo.metaOverride}<button type="submit" name="clear" value="on" class="tb"
								>자동으로</button
							>{/if}
						<a href="/admin/gear" class="dim">장비 등록</a>
					</div>
				</form>
			{/if}
			{#if data.similar.length}
				<section class="similar">
					<h3>비슷한 사진</h3>
					<PhotoGrid items={data.similar} ctx="archive" targetHeight={96} gap={6} />
				</section>
			{/if}
		</aside>
	{/if}
</main>

<style>
	.similar {
		margin-top: 28px;
	}
	.similar h3 {
		font-family: var(--font-mono);
		font-size: 12px;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--color-amber);
		margin: 0 0 10px;
	}
	/* 버튼 줄은 화면 바닥이 아니라 사진 바로 밑에 — 모바일 주소창이 들어가고 나와도(보이는 높이가 바뀌어도) 움직이지 않게 */
	.photo {
		display: grid;
		align-content: start;
		grid-template-columns: 1fr;
		padding: 0 40px 28px;
		gap: 16px;
	}
	.photo.info {
		grid-template-columns: 1fr 380px;
	}
	/* 화살표는 사진 양옆 자리에 — 사진 위에 겹치지 않게 */
	figure {
		position: relative;
		margin: 0;
		display: grid;
		grid-template-columns: 56px minmax(0, 1fr) 56px;
		/* 줄 높이를 figure 높이로 고정 — auto 면 사진 영역(.stage)의 height:100% 가 안 먹어, 처음 연 세로 사진이 원래 비율로
		   커져 버튼을 가렸다 */
		grid-template-rows: minmax(0, 1fr);
		align-items: center;
		/* svh: 주소창이 다 나와 있을 때의 화면 높이 — 스크롤로 주소창이 숨어도 크기가 바뀌지 않는다. 헤더 + 버튼 줄 자리를 뺀다 */
		height: calc(100svh - 240px);
		min-height: 300px;
	}
	/* 관리자: 컴퓨터는 관리 도구가 같은 줄이라 조금만 더 뺀다(좁은 창에서 두 줄로 감길 때 대비) */
	.photo.admin figure {
		height: calc(100svh - 260px);
	}
	.stage {
		transition: transform 0.2s ease;
		grid-column: 2;
		grid-row: 1;
		height: 100%;
		min-width: 0;
		display: flex;
		align-items: center;
		justify-content: center;
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
	figure img.no-anim {
		transition: none;
	}
	figure img:global(.loaded) {
		opacity: 1;
	}
	.stage.dragging {
		transition: none;
	}
	.arrow {
		grid-row: 1;
		align-self: stretch;
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: var(--font-serif);
		font-size: 28px;
		color: var(--color-ink-dim);
		opacity: 0.5;
		transition: opacity 0.2s;
	}
	.arrow.prev {
		grid-column: 1;
	}
	.arrow.next {
		grid-column: 3;
	}
	figure:hover .arrow,
	.arrow:focus-visible {
		opacity: 1;
	}
	.bar {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 14px;
	}
	.toolbar {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		align-items: center;
		gap: 10px 18px;
	}
	.line {
		margin: 0;
		font-size: 17px;
		letter-spacing: 0.06em;
		min-width: 0;
		text-align: center;
	}
	/* 항목 하나는 안 쪼개고 항목 사이에서만 줄바꿈 — 점은 앞 항목 끝에 붙어 새 줄이 점으로 시작하지 않는다 */
	.part {
		white-space: nowrap;
	}
	.part:not(:last-of-type)::after {
		content: ' ·';
		color: var(--color-ink-faint);
		margin-right: 0.25em;
	}
	.tools,
	.admin-tools {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
	}
	/* 컴퓨터: 보기 도구 옆에 세로 점선으로 나눠 이어 붙인다 */
	.admin-tools {
		padding-left: 18px;
		border-left: 1px dashed var(--color-ink-faint);
	}
	.admin-tools .lbl {
		font-size: 12px;
		letter-spacing: 0.16em;
		color: var(--color-amber);
		margin-right: 4px;
	}
	.admin-tools form:not(.seg) {
		display: contents;
	}
	/* 사진 페이지 버튼은 전부 이 한 가지 — 높이·글자·테두리가 같다 */
	.tb {
		box-sizing: border-box;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		height: 36px;
		padding: 0 14px;
		font-family: var(--font-mono);
		font-size: 14px;
		letter-spacing: 0.06em;
		white-space: nowrap;
		border-radius: 999px;
		border: 1px solid var(--color-ink-faint);
		background: transparent;
		color: var(--color-ink-soft);
		cursor: pointer;
		transition:
			border-color 0.15s,
			color 0.15s;
	}
	.tb:hover:not(:disabled) {
		border-color: var(--color-ink);
		color: var(--color-ink);
	}
	.tb.on {
		border-color: var(--color-amber);
		color: var(--color-amber);
	}
	.tb:disabled {
		opacity: 0.5;
		cursor: default;
	}
	.tb.icon {
		width: 40px;
		padding: 0;
	}
	.tb.same-width {
		min-width: 7em;
	}
	select.tb {
		appearance: none;
		background: #141311;
		padding: 0 14px;
		max-width: 14em;
		text-overflow: ellipsis;
		color-scheme: dark;
	}
	/* 붙은 버튼 묶음 (한 가지를 고르는 것들) — 양 끝만 둥글게, 사이 테두리는 하나로 */
	.seg {
		display: inline-flex;
	}
	.seg > .tb {
		border-radius: 0;
	}
	.seg > .tb + .tb {
		margin-left: -1px;
	}
	.seg > .tb:first-child {
		border-radius: 999px 0 0 999px;
		padding-left: 16px;
	}
	.seg > .tb:last-child {
		border-radius: 0 999px 999px 0;
		padding-right: 16px;
	}
	.seg > .tb.icon:first-child,
	.seg > .tb.icon:last-child {
		padding: 0;
		width: 44px;
	}
	.seg > .tb.on,
	.seg > .tb:hover {
		position: relative;
		z-index: 1;
	}
	.meta-edit {
		margin-top: 18px;
		padding-top: 14px;
		border-top: 1px solid var(--color-ink-faint);
		display: grid;
		gap: 8px;
		font-family: var(--font-mono);
		font-size: 15px;
	}
	.meta-edit h3 {
		margin: 0 0 4px;
		font-weight: 500;
		font-size: 13px;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--color-amber);
	}
	.meta-edit label,
	.meta-edit .ro {
		display: grid;
		/* 위 사양표(SpecSheet dl: 100px, 간격 14px)와 같은 칸 — 값이 같은 세로줄에서 시작 */
		grid-template-columns: 100px minmax(0, 1fr);
		align-items: center;
		gap: 14px;
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
		grid-row: 1 / span 3;
		border-left: 1px solid var(--color-ink-faint);
		padding: 8px 0 0 24px;
		max-height: calc(100svh - 120px);
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
		/* 좁은 화면은 화살표 대신 밀어서 넘김 — 양옆 자리도 사진에 */
		figure {
			grid-template-columns: minmax(0, 1fr);
		}
		.stage {
			grid-column: 1;
		}
		/* 폰: 사진 칸 높이는 사진마다 바뀌지 않게 고정(버튼이 제자리), 대신 4:5 비율까지만 — 가로·정사각 사진 위아래 빈칸을 줄인다 */
		figure {
			height: min(calc(100svh - 240px), calc((100vw - 32px) * 1.25));
			min-height: 240px;
		}
		.photo.admin figure {
			height: min(calc(100svh - 320px), calc((100vw - 32px) * 1.25));
		}
		.photo {
			gap: 14px;
		}
		.line {
			font-size: 15px;
		}
		/* 폰: 왼쪽 정렬, 줄마다 쌓기. 관리 도구는 가로 점선 밑 */
		.bar {
			align-items: stretch;
			gap: 12px;
		}
		.line {
			text-align: left;
		}
		.toolbar {
			flex-direction: column;
			align-items: stretch;
			gap: 12px;
		}
		.admin-tools {
			padding: 12px 0 0;
			border-left: 0;
			border-top: 1px dashed var(--color-ink-faint);
		}
		.tools {
			width: 100%;
		}
		/* 정보는 줄 오른쪽 끝 — 엄지로 찾기 쉬운 자리 */
		.info-btn {
			margin-left: auto;
		}
		.tools {
			gap: 6px;
		}
		.tb {
			height: 40px;
			padding: 0 12px;
			font-size: 13px;
		}
		/* 관리 줄: 점선이 이미 구분해 주니 '관리' 글자는 빼고, 숨기기 폭도 줄여 한 줄에 */
		.admin-tools .lbl {
			display: none;
		}
		.tb.same-width {
			min-width: 6em;
		}
		/* 사진 칸 높이는 고정이라 가로 사진이면 빈칸이 생긴다 — 사진을 아래(설명 쪽)에 붙여 빈칸이 헤더 밑 여백이 되게 */
		.stage {
			align-items: flex-end;
		}
		.seg > .tb:first-child {
			padding-left: 14px;
		}
		.seg > .tb:last-child {
			padding-right: 14px;
		}
		.seg > .tb.icon:first-child,
		.seg > .tb.icon:last-child {
			width: 40px;
		}
	}
</style>
