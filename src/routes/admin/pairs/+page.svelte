<script lang="ts">
	// 페어링 관리: 탭(검토 / 자동 / 확정 / 원본 없음)마다 화면을 채우는 카드 그리드 + 무한 스크롤.
	// 묶인 것은 보정본만 보이고, 올려 두면 원본이 말풍선으로, 누르면 원본·보정 비교 창. 조작은 JSON API 로 하고 목록에서 바로 뺀다.
	import { onMount, tick } from 'svelte';
	import {
		PAIR_TABS,
		PAIR_TAB_LABEL,
		type PairItem,
		type PairListItem,
		type PairPage,
		type PairTab,
		type Thumb
	} from '#lib/pairs.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	// svelte-ignore state_referenced_locally
	let items = $state<PairListItem[]>(data.items);
	// svelte-ignore state_referenced_locally
	let nextCursor = $state<string | null>(data.nextCursor);
	// svelte-ignore state_referenced_locally
	let counts = $state<Record<PairTab, number>>({ ...data.counts });
	// svelte-ignore state_referenced_locally
	let loadedStamp = data.stamp;
	let loading = $state(false);
	let notice = $state<string | null>(null);
	let error = $state<string | null>(null);
	let modal = $state<PairItem | null>(null);
	let peek = $state<{ item: PairItem; style: string } | null>(null);
	let dlg: HTMLDialogElement | undefined = $state();
	// 원본 없는 보정본 카드: 입력한 파일명 일부에 맞는 원본 후보 (편집 파일 id → 후보들)
	let suggest = $state<Record<string, Thumb[]>>({});
	let suggestTimer = 0;
	let bottomEl: HTMLElement | undefined = $state();

	// 탭을 바꾸거나 일괄 작업 뒤 load 가 다시 돌면 목록을 새로
	$effect(() => {
		if (data.stamp === loadedStamp) return;
		loadedStamp = data.stamp;
		items = data.items;
		nextCursor = data.nextCursor;
		counts = { ...data.counts };
		modal = null;
		peek = null;
		tick().then(checkSentinel);
	});
	$effect(() => {
		if (!dlg) return;
		if (modal && !dlg.open) dlg.showModal();
		else if (!modal && dlg.open) dlg.close();
	});

	const fmtScore = (s: number | null) => (s == null ? '-' : s.toFixed(2));

	async function loadMore() {
		if (loading || !nextCursor) return;
		loading = true;
		try {
			const r = await fetch(
				`/api/admin/pairs?tab=${data.tab}&cursor=${encodeURIComponent(nextCursor)}`
			);
			if (!r.ok) throw new Error(`HTTP ${r.status}`);
			const page = (await r.json()) as PairPage;
			const seen = new Set(items.map((x) => x.cursor));
			items = [...items, ...page.items.filter((x) => !seen.has(x.cursor))];
			nextCursor = page.nextCursor;
			error = null;
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			loading = false;
			tick().then(checkSentinel);
		}
	}
	function checkSentinel() {
		if (typeof window === 'undefined' || !bottomEl || loading || !nextCursor) return;
		const r = bottomEl.getBoundingClientRect();
		if (r.top < window.innerHeight + 900) void loadMore();
	}

	/** 한 건 조작 → 성공하면 목록에서 빼고 탭 숫자를 맞춘다 */
	async function act(body: Record<string, unknown>, item: PairListItem) {
		const r = await fetch('/api/admin/pairs', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		});
		const j = (await r.json().catch(() => ({}))) as { message?: string; error?: string };
		if (!r.ok) {
			error = j.error ?? `HTTP ${r.status}`;
			return;
		}
		error = null;
		notice = j.message ?? null;
		const a = body.action as string;
		const before = items.length;
		// 후보 거부는 그 쌍만, 나머지는 그 보정본의 항목 전부(같은 보정본의 다른 후보 포함)
		items = items.filter((x) =>
			a === 'rejectCandidate' ? x !== item : x.edit.id !== item.edit.id
		);
		const removed = before - items.length;
		counts[data.tab] = Math.max(0, counts[data.tab] - removed);
		if (a === 'confirmCandidate' || a === 'manual' || a === 'accept') counts.confirmed++;
		if (a === 'unconfirm') counts.auto++;
		if (a === 'unpair') counts.unpaired++;
		modal = null;
		peek = null;
		tick().then(checkSentinel);
	}

	// 올려 두면 원본 말풍선 (살짝 지연, 카드 오른쪽에 자리 없으면 왼쪽)
	let peekTimer = 0;
	function peekIn(item: PairItem, el: HTMLElement) {
		clearTimeout(peekTimer);
		peekTimer = window.setTimeout(() => {
			const r = el.getBoundingClientRect();
			const w = 300;
			const toLeft = r.right + w + 16 > window.innerWidth;
			const top = Math.max(8, Math.min(r.top, window.innerHeight - 260));
			const style = toLeft
				? `top:${top}px;right:${window.innerWidth - r.left + 8}px`
				: `top:${top}px;left:${r.right + 8}px`;
			peek = { item, style };
		}, 350);
	}
	function peekOut() {
		clearTimeout(peekTimer);
		peek = null;
	}

	/** 파일명 일부를 치면 잠시 뒤 원본 후보를 불러온다 (같은 이름이 여러 폴더에 있어도 경로·썸네일로 고른다) */
	function suggestInput(e: Event, item: PairListItem) {
		const q = (e.currentTarget as HTMLInputElement).value.trim();
		clearTimeout(suggestTimer);
		if (q.length < 2) {
			suggest[item.edit.id] = [];
			return;
		}
		suggestTimer = window.setTimeout(async () => {
			try {
				const r = await fetch(`/api/admin/pairs?find=${encodeURIComponent(q)}`);
				if (!r.ok) throw new Error(`HTTP ${r.status}`);
				suggest[item.edit.id] = ((await r.json()) as { files: Thumb[] }).files;
			} catch (err) {
				error = err instanceof Error ? err.message : String(err);
			}
		}, 250);
	}
	function manualSubmit(e: SubmitEvent, item: PairListItem) {
		e.preventDefault();
		// 엔터: 후보가 하나뿐이면 그걸로 연결
		const list = suggest[item.edit.id] ?? [];
		if (list.length === 1)
			void act({ action: 'manual', editId: item.edit.id, originalId: list[0].id }, item);
	}
	function pickOriginal(item: PairListItem, o: Thumb) {
		void act({ action: 'manual', editId: item.edit.id, originalId: o.id }, item);
	}

	onMount(() => {
		const io = new IntersectionObserver(
			(entries) => {
				if (entries.some((e) => e.isIntersecting)) void loadMore();
			},
			{ rootMargin: '900px 0px' }
		);
		if (bottomEl) io.observe(bottomEl);
		checkSentinel();
		return () => io.disconnect();
	});
</script>

<section class="admin-page">
	<h1>페어링</h1>
	<p class="mono dim">
		보정본과 원본을 한 장으로 묶습니다. 파일명(stem)·촬영시각·카메라·pHash 로 점수를 매겨 0.8 이상은
		자동으로 묶이고, 0.5~0.8 은 '검토 필요'에서 고릅니다. 묶인 것은 보정본만 보입니다 — 올려 두면
		원본이 떠서 잘못 묶인 걸 빠르게 찾을 수 있고, 누르면 나란히 비교하며 풀 수 있습니다.
	</p>
	{#if data.originals.total === 0}
		<p class="notice error">
			원본(역할: 원본) 라이브러리에 파일이 없습니다. 원본 폴더를 먼저 등록하세요.
		</p>
	{:else if data.originals.ready < data.originals.total}
		<p class="notice">
			원본 {data.originals.total}장 중 처리 완료 {data.originals.ready}장{#if data.originals.failed}
				· 실패 {data.originals.failed}장(대시보드에서 사유 확인){/if}{#if data.originals.missing}
				· 없어짐 {data.originals.missing}장{/if}. 페어링은 처리가 끝난 원본만 후보로 잡고, 원본이
			처리되면 자동으로 다시 묶입니다.
		</p>
	{/if}
	{#if form?.ok}<p class="notice">{form.ok}</p>{/if}
	{#if notice}<p class="notice">{notice}</p>{/if}
	{#if error}<p class="notice error">{error}</p>{/if}

	<div class="bar">
		<nav class="tabs mono" aria-label="페어링 상태">
			{#each PAIR_TABS as t (t)}
				<a href={`?tab=${t}`} class:on={data.tab === t}
					>{PAIR_TAB_LABEL[t]} <span class="n">{counts[t]}</span></a
				>
			{/each}
		</nav>
		<div class="bulk">
			{#if data.tab === 'auto' && counts.auto > 0}
				<form
					method="POST"
					action="?/acceptAll&tab=auto"
					onsubmit={(e) => {
						if (!confirm(`미확정 ${counts.auto}건을 전부 확정할까요?`)) e.preventDefault();
					}}
				>
					<button class="btn" type="submit">미확정 전부 확정</button>
				</form>
			{/if}
			{#if data.tab === 'confirmed' && counts.confirmed > 0}
				<form
					method="POST"
					action="?/unconfirmAll&tab=confirmed"
					onsubmit={(e) => {
						if (
							!confirm(
								`확정 ${counts.confirmed}건을 전부 미확정으로 되돌릴까요? 연결은 그대로 두고 '자동 묶임' 탭으로 갑니다.`
							)
						)
							e.preventDefault();
					}}
				>
					<button class="btn quiet" type="submit">확정 전부 취소</button>
				</form>
			{/if}
			{#if data.tab === 'unpaired'}
				<form method="POST" action="?/rerun&tab=unpaired">
					<button class="btn quiet" type="submit">전체 다시 페어링</button>
				</form>
			{/if}
		</div>
	</div>

	{#if items.length === 0}
		<p class="dim">없습니다.</p>
	{/if}
	<div class="grid" class:review={data.tab === 'review'} class:unpaired={data.tab === 'unpaired'}>
		{#each items as item (item.cursor)}
			{#if item.kind === 'pair'}
				<button
					type="button"
					class="card pair"
					onclick={() => (modal = item)}
					onpointerenter={(e) => peekIn(item, e.currentTarget)}
					onpointerleave={peekOut}
					aria-label={`${item.edit.filename} — 원본과 비교`}
				>
					<img src={item.edit.thumb} alt="" loading="lazy" />
					<span class="cap mono">
						<span class="name">{item.edit.filename}</span>
						<span class="dim">{fmtScore(item.score)} · {item.method ?? '-'}</span>
					</span>
				</button>
			{:else if item.kind === 'review'}
				<div class="card review">
					<div class="duo">
						<img src={item.edit.thumb} alt="" loading="lazy" />
						<img src={item.original.thumb} alt="" loading="lazy" />
					</div>
					<div class="cap mono">
						<span class="name">보정 · {item.edit.filename}</span>
						<span class="name"
							>원본 · {item.original.filename}
							<span class="dim">· {item.original.source}</span></span
						>
						<span class="dim">점수 {item.score.toFixed(2)} · {item.method}</span>
					</div>
					<div class="acts">
						<button
							class="btn primary"
							type="button"
							onclick={() =>
								act(
									{
										action: 'confirmCandidate',
										editId: item.edit.id,
										originalId: item.original.id
									},
									item
								)}>맞음</button
						>
						<button
							class="btn quiet"
							type="button"
							onclick={() =>
								act(
									{ action: 'rejectCandidate', editId: item.edit.id, originalId: item.original.id },
									item
								)}>아님</button
						>
					</div>
				</div>
			{:else}
				<div class="card unpaired">
					<img src={item.edit.thumb} alt="" loading="lazy" />
					<div class="cap mono">
						<span class="name">{item.edit.filename}</span>
						<span class="dim name">{item.edit.source} · {item.edit.relPath}</span>
					</div>
					<form class="manual" onsubmit={(e) => manualSubmit(e, item)}>
						<input
							name="query"
							placeholder="원본 파일명 일부 (예: 0456)"
							aria-label="원본 파일명"
							autocomplete="off"
							oninput={(e) => suggestInput(e, item)}
						/>
					</form>
					{#if (suggest[item.edit.id] ?? []).length > 0}
						<ul class="suggest" aria-label="원본 후보">
							{#each suggest[item.edit.id] as o (o.id)}
								<li>
									<button type="button" onclick={() => pickOriginal(item, o)}>
										<img src={o.thumb} alt="" loading="lazy" />
										<span class="mono">
											<span class="name">{o.filename}</span>
											<span class="dim name">{o.source} · {o.relPath}</span>
										</span>
									</button>
								</li>
							{/each}
						</ul>
					{/if}
				</div>
			{/if}
		{/each}
	</div>
	<div class="sentinel" bind:this={bottomEl} aria-hidden="true"></div>
	<p class="mono dim status">
		{#if loading}불러오는 중…{:else if !nextCursor && items.length > 0}끝 · {items.length}건{/if}
	</p>
</section>

{#if peek}
	<div class="peek" style={peek.style} aria-hidden="true">
		<img src={peek.item.original.thumb} alt="" />
		<span class="mono"
			>원본 · {peek.item.original.filename}<br /><span class="dim"
				>{peek.item.original.source} · {peek.item.original.relPath}</span
			></span
		>
	</div>
{/if}

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions -->
<dialog
	class="modal"
	bind:this={dlg}
	onclose={() => (modal = null)}
	onclick={(e) => {
		if (e.target === dlg) modal = null;
	}}
>
	{#if modal}
		{@const m = modal}
		<div class="cmp">
			<figure>
				<img src={m.original.preview} alt="" />
				<figcaption class="mono">
					원본 · {m.original.filename}<br /><span class="dim"
						>{m.original.source} · {m.original.relPath}</span
					>
				</figcaption>
			</figure>
			<figure>
				<img src={m.edit.preview} alt="" />
				<figcaption class="mono">
					보정 · {m.edit.filename}<br /><span class="dim">{m.edit.source} · {m.edit.relPath}</span>
				</figcaption>
			</figure>
		</div>
		<div class="mbar mono">
			<span>점수 {fmtScore(m.score)} · {m.method ?? '-'} · {m.confirmed ? '확정' : '미확정'}</span>
			<div class="acts">
				<a class="btn quiet" href={`/p/${m.photoId}`}>사진 페이지</a>
				{#if m.confirmed}
					<button
						class="btn quiet"
						type="button"
						onclick={() => act({ action: 'unconfirm', photoId: m.photoId }, m)}>미확정으로</button
					>
				{:else}
					<button
						class="btn"
						type="button"
						onclick={() => act({ action: 'accept', photoId: m.photoId }, m)}>확정</button
					>
				{/if}
				<button
					class="btn danger"
					type="button"
					onclick={() => act({ action: 'unpair', editId: m.edit.id }, m)}>연결 풀기</button
				>
				<button class="btn quiet" type="button" onclick={() => (modal = null)}>닫기</button>
			</div>
			<span class="hint dim"
				>미확정으로 = 연결은 두고 '자동 묶임' 탭으로 되돌려 다시 검토 · 연결 풀기 = 보정본을 떼어
				단독 사진으로</span
			>
		</div>
	{/if}
</dialog>

<style>
	.bar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 16px;
		flex-wrap: wrap;
		margin: 0 0 18px;
	}
	.tabs {
		display: flex;
		gap: 4px;
		flex-wrap: wrap;
		font-size: 13px;
		letter-spacing: 0.06em;
	}
	.tabs a {
		padding: 8px 14px;
		border: 1px solid var(--color-ink-faint);
		color: var(--color-ink-dim);
	}
	.tabs a.on {
		color: var(--color-amber);
		border-color: var(--color-amber);
	}
	.tabs .n {
		opacity: 0.7;
		margin-left: 4px;
	}
	.bulk {
		display: flex;
		gap: 8px;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
		gap: 12px;
	}
	.grid.review {
		grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
	}
	.grid.unpaired {
		grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
	}
	.card {
		display: block;
		width: 100%;
		margin: 0;
		padding: 0;
		text-align: left;
		background: #141311;
		border: 1px solid var(--color-ink-faint);
		color: inherit;
		font: inherit;
	}
	.card.pair {
		cursor: pointer;
	}
	.card.pair:hover,
	.card.pair:focus-visible {
		border-color: var(--color-amber);
		outline: none;
	}
	.card img {
		display: block;
		width: 100%;
		aspect-ratio: 3 / 2;
		object-fit: cover;
		background: #000;
	}
	.duo {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 2px;
	}
	.cap {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 8px 10px;
		font-size: 11px;
		letter-spacing: 0.04em;
		line-height: 1.4;
	}
	.name {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.acts {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
		padding: 0 10px 10px;
	}
	.manual {
		display: flex;
		gap: 6px;
		padding: 0 10px 10px;
	}
	.manual input {
		flex: 1;
		min-width: 0;
		font: inherit;
		font-size: 12px;
		padding: 8px 10px;
		background: #0b0b0a;
		border: 1px solid var(--color-ink-faint);
		color: var(--color-ink);
	}
	.suggest {
		list-style: none;
		margin: 0;
		padding: 0 10px 10px;
		display: flex;
		flex-direction: column;
		gap: 4px;
		max-height: 320px;
		overflow-y: auto;
	}
	.suggest button {
		display: flex;
		gap: 8px;
		align-items: center;
		width: 100%;
		padding: 4px;
		margin: 0;
		background: #0b0b0a;
		border: 1px solid var(--color-ink-faint);
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
	}
	.suggest button:hover {
		border-color: var(--color-amber);
	}
	.suggest img {
		width: 64px;
		aspect-ratio: 3 / 2;
		object-fit: cover;
		flex: none;
	}
	.suggest .mono {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
		font-size: 11px;
	}
	.sentinel {
		height: 1px;
	}
	.status {
		min-height: 20px;
		padding: 20px 0 0;
		font-size: 12px;
		letter-spacing: 0.08em;
		text-align: center;
	}
	.peek {
		position: fixed;
		z-index: 30;
		width: 300px;
		padding: 6px;
		background: #0b0b0a;
		border: 1px solid var(--color-ink-faint);
		box-shadow: 0 12px 32px rgba(0, 0, 0, 0.65);
		pointer-events: none;
		font-size: 11px;
		line-height: 1.4;
	}
	.peek img {
		display: block;
		width: 100%;
		aspect-ratio: 3 / 2;
		object-fit: contain;
		background: #000;
		margin-bottom: 6px;
	}
	dialog.modal {
		margin: auto; /* 전역 reset 이 margin:0 으로 만들어 좌상단에 붙던 것을 가운데로 */
		width: min(96vw, 1400px);
		max-width: 96vw;
		padding: 0;
		background: #0b0b0a;
		color: var(--color-ink);
		border: 1px solid var(--color-ink-faint);
	}
	dialog.modal::backdrop {
		background: rgba(0, 0, 0, 0.75);
	}
	.cmp {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 2px;
		background: #000;
	}
	.cmp figure {
		margin: 0;
		min-width: 0;
	}
	/* 비율이 달라도 두 상자 높이를 같게 — 캡션이 같은 줄에 온다 */
	.cmp img {
		display: block;
		width: 100%;
		height: min(70vh, 820px);
		object-fit: contain;
		background: #000;
	}
	.cmp figcaption {
		padding: 8px 12px;
		font-size: 12px;
		line-height: 1.4;
		background: #0b0b0a;
	}
	.mbar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
		flex-wrap: wrap;
		padding: 12px 16px;
		font-size: 12px;
	}
	.mbar .acts {
		padding: 0;
	}
	.hint {
		flex-basis: 100%;
		font-size: 11px;
	}
	@media (max-width: 720px) {
		.cmp {
			grid-template-columns: 1fr;
		}
		.cmp img {
			height: 38vh;
		}
	}
</style>
