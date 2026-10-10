<script lang="ts">
	// 아카이브: 촬영일(필름은 현상월) 내림차순 무한 스크롤 + 우측 월 타임라인.
	// 서버가 준 첫 페이지에서 시작해 아래(과거)로 이어 붙이고, ?from= 으로 중간부터 시작했으면 위(최근)로도 이어 붙인다.
	import { onMount, tick } from 'svelte';
	import { goto } from '$app/navigation';
	import ArchiveFilters from '#lib/components/ArchiveFilters.svelte';
	import ArchiveTimeline from '#lib/components/ArchiveTimeline.svelte';
	import PhotoGrid from '#lib/components/PhotoGrid.svelte';
	import {
		archiveCtx,
		archiveHref,
		filterParams,
		groupByMonth,
		type ArchiveFilter
	} from '#lib/archive.ts';
	import type { GalleryItem } from '#lib/server/gallery.ts';
	import type { PageProps, Snapshot } from './$types';

	let { data }: PageProps = $props();
	// 필터는 주소(/archive?medium=…)와 ctx(사진 페이지 prev/next)와 API 호출에 똑같이 실린다
	const ctx = $derived(archiveCtx(data.filter));
	const qs = $derived(filterParams(data.filter).toString());
	const homeHref = $derived(archiveHref(data.filter));

	type Page = { items: GalleryItem[]; hasMore: boolean };
	const HEADER_TOP = 110; // 사이트 헤더 아래, 월 제목을 맞추는 기준선
	const loadKey = (d: { filter: ArchiveFilter; from: string | null }) =>
		`${filterParams(d.filter)}|${d.from ?? ''}`;
	// svelte-ignore state_referenced_locally
	let loadedFor = loadKey(data);
	// svelte-ignore state_referenced_locally
	let items = $state<GalleryItem[]>(data.items);
	// svelte-ignore state_referenced_locally
	let olderDone = $state(!data.hasMore);
	// svelte-ignore state_referenced_locally
	let newerDone = $state(!data.from); // 최신부터 시작했으면 위로는 더 없다
	let loading = $state<'older' | 'newer' | null>(null);
	let error = $state<string | null>(null);
	let active = $state<string | null>(null);
	// ?from= 으로 시작했으면 첫 '최근' 페이지를 끼워 넣은 뒤 그 달 제목을 화면 위에 고정한다
	// svelte-ignore state_referenced_locally
	let pinMonth: string | null = data.from;

	let listEl: HTMLElement | undefined = $state();
	let topEl: HTMLElement | undefined = $state();
	let bottomEl: HTMLElement | undefined = $state();

	const groups = $derived(groupByMonth(items, data.zone));

	// B컷 토글이나 월 점프로 load 가 다시 돌면 목록을 새 첫 페이지로 바꾼다
	$effect(() => {
		const k = loadKey(data);
		if (k === loadedFor) return;
		loadedFor = k;
		items = data.items;
		olderDone = !data.hasMore;
		newerDone = !data.from;
		pinMonth = data.from;
		error = null;
		tick().then(checkSentinels);
	});

	// 뒤로 가기 때 이어 붙인 목록과 스크롤 위치가 살아나도록
	export const snapshot: Snapshot<{
		key: string;
		items: GalleryItem[];
		olderDone: boolean;
		newerDone: boolean;
		scrollY: number;
	}> = {
		capture: () => ({
			key: loadedFor,
			items: $state.snapshot(items).slice(0, 4000),
			olderDone,
			newerDone,
			scrollY: window.scrollY
		}),
		restore: (v) => {
			if (v.key !== loadedFor) return;
			items = v.items;
			olderDone = v.olderDone;
			newerDone = v.newerDone;
			pinMonth = null;
			// SvelteKit 의 스크롤 복원은 목록이 다시 그려지기 전에 돌 수 있어(높이 부족 → 0 으로 잘림) 직접 되돌린다
			const y = v.scrollY;
			const go = () => window.scrollTo(0, y);
			tick().then(() => {
				go();
				requestAnimationFrame(() => {
					go();
					requestAnimationFrame(go);
				});
			});
		}
	};

	async function fetchPage(dir: 'older' | 'newer', edge: GalleryItem): Promise<Page> {
		const u = `/api/archive?dir=${dir}&id=${encodeURIComponent(edge.id)}&ta=${encodeURIComponent(edge.takenAt ?? '')}${qs ? `&${qs}` : ''}`;
		const r = await fetch(u);
		if (!r.ok) throw new Error(`HTTP ${r.status}`);
		return (await r.json()) as Page;
	}
	function merge(a: GalleryItem[], b: GalleryItem[]): GalleryItem[] {
		const seen = new Set(a.map((x) => x.id));
		return [...a, ...b.filter((x) => !seen.has(x.id))];
	}

	async function loadOlder() {
		if (loading || olderDone || items.length === 0) return;
		loading = 'older';
		try {
			const r = await fetchPage('older', items[items.length - 1]);
			items = merge(items, r.items);
			olderDone = !r.hasMore;
			error = null;
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			loading = null;
			tick().then(checkSentinels);
		}
	}

	async function loadNewer() {
		if (loading || newerDone || items.length === 0) return;
		loading = 'newer';
		try {
			const first = items[0];
			const r = await fetchPage('newer', first);
			newerDone = !r.hasMore;
			if (r.items.length) {
				const pin = pinMonth;
				pinMonth = null;
				await prependKeepingView(first.id, () => (items = merge(r.items, items)), pin);
			}
			error = null;
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			loading = null;
			tick().then(checkSentinels);
		}
	}

	/** 위에 끼워 넣어도 보던 사진이 같은 자리에 있도록 스크롤을 보정한다 (그리드 재배치 뒤 한 번 더).
	 *  pin 이 있으면(월 점프 직후) 그 달 제목을 화면 위쪽에 맞춘다. */
	async function prependKeepingView(anchorId: string, apply: () => void, pin: string | null) {
		const find = () =>
			pin
				? listEl?.querySelector<HTMLElement>(`[data-month="${pin}"]`)
				: listEl?.querySelector<HTMLElement>(`[data-id="${anchorId}"]`);
		const target = pin ? HEADER_TOP : find()?.getBoundingClientRect().top;
		apply();
		await tick();
		if (target === undefined) return;
		const fix = () => {
			const a = find();
			if (!a) return;
			const d = a.getBoundingClientRect().top - target;
			if (Math.abs(d) > 0.5) window.scrollBy(0, d);
		};
		fix();
		requestAnimationFrame(() => {
			fix();
			requestAnimationFrame(fix);
		});
		setTimeout(fix, 150);
	}

	// IntersectionObserver 는 상태가 바뀔 때만 알려주므로, 불러온 뒤에도 센티널이 여전히 화면 근처면 직접 이어서 부른다
	function checkSentinels() {
		if (typeof window === 'undefined' || loading) return;
		const near = (el?: HTMLElement) => {
			if (!el) return false;
			const r = el.getBoundingClientRect();
			return r.bottom > -900 && r.top < window.innerHeight + 900;
		};
		if (!olderDone && near(bottomEl)) void loadOlder();
		else if (!newerDone && near(topEl)) void loadNewer();
		updateActive();
	}

	function updateActive() {
		if (!listEl) return;
		const heads = listEl.querySelectorAll<HTMLElement>('[data-month]');
		const line = 150;
		let cur: string | null = null;
		for (const h of heads) {
			if (h.getBoundingClientRect().top <= line) cur = h.dataset.month ?? null;
			else break;
		}
		active = cur ?? heads[0]?.dataset.month ?? null;
	}

	function jump(key: string) {
		// 이미 불러온 달이면 그 자리로 스크롤, 아니면 그 달부터 다시 시작
		const h = listEl?.querySelector<HTMLElement>(`[data-month="${key}"]`);
		if (h) {
			window.scrollTo({
				top: window.scrollY + h.getBoundingClientRect().top - 120,
				behavior: 'smooth'
			});
			return;
		}
		void goto(archiveHref(data.filter, { from: key }));
	}

	onMount(() => {
		const io = new IntersectionObserver(
			(entries) => {
				for (const e of entries) {
					if (!e.isIntersecting) continue;
					if (e.target === bottomEl) void loadOlder();
					else if (e.target === topEl) void loadNewer();
				}
			},
			{ rootMargin: '900px 0px 900px 0px' }
		);
		if (topEl) io.observe(topEl);
		if (bottomEl) io.observe(bottomEl);
		let raf = 0;
		const onScroll = () => {
			if (raf) return;
			raf = requestAnimationFrame(() => {
				raf = 0;
				updateActive();
			});
		};
		window.addEventListener('scroll', onScroll, { passive: true });
		window.addEventListener('resize', onScroll);
		checkSentinels();
		return () => {
			io.disconnect();
			window.removeEventListener('scroll', onScroll);
			window.removeEventListener('resize', onScroll);
			if (raf) cancelAnimationFrame(raf);
		};
	});
</script>

<section class="page" class:with-timeline={data.months.length > 0}>
	<header class="head">
		<h1>아카이브</h1>
		<p class="mono dim">
			{data.total}장
			{#if data.from}
				· <a href={homeHref}>최신부터</a>
			{/if}
		</p>
	</header>
	{#if !data.noDb}
		<ArchiveFilters filter={data.filter} facets={data.facets} />
	{/if}
	{#if data.noDb}
		<p class="mono dim">DATABASE_URL 이 없습니다.</p>
	{:else if groups.length === 0}
		<p class="mono dim">
			{#if data.from}이 달 이전에는 사진이 없습니다. <a href={homeHref}>최신부터 보기</a
				>{:else if qs}조건에 맞는 사진이 없습니다. <a href="/archive">필터 지우기</a>{:else}아직
				공개된 사진이 없습니다.{/if}
		</p>
	{/if}
	<div class="list" bind:this={listEl}>
		<div class="sentinel" bind:this={topEl} aria-hidden="true"></div>
		{#if loading === 'newer'}<p class="mono dim status">불러오는 중…</p>{/if}
		{#each groups as g (g.key)}
			<section class="month">
				<h2 data-month={g.key}>{g.label}</h2>
				<PhotoGrid items={g.items} {ctx} />
			</section>
		{/each}
		<div class="sentinel" bind:this={bottomEl} aria-hidden="true"></div>
		<p class="mono dim status" aria-live="polite">
			{#if loading === 'older'}
				불러오는 중…
			{:else if error}
				불러오지 못했습니다 ({error}) <button type="button" onclick={loadOlder}>다시 시도</button>
			{:else if olderDone && items.length > 0}
				끝 · {items.length}장
			{/if}
		</p>
	</div>
	{#if data.months.length > 0}
		<ArchiveTimeline months={data.months} {active} onjump={jump} />
	{/if}
</section>

<style>
	.page {
		padding: 8px 40px 60px;
	}
	.page.with-timeline {
		padding-right: 84px;
	}
	.head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 20px;
		margin: 12px 0 28px;
	}
	h1 {
		font-family: var(--font-serif);
		font-weight: 400;
		font-size: clamp(40px, 6vw, 84px);
		line-height: 1;
		margin: 0;
	}
	h2 {
		font-family: var(--font-serif);
		font-weight: 400;
		font-size: 26px;
		color: var(--color-ink-soft);
		margin: 44px 0 14px;
		scroll-margin-top: 120px;
	}
	.month:first-of-type h2 {
		margin-top: 0;
	}
	.head p {
		font-size: 17px;
		letter-spacing: 0.06em;
	}
	.head a:hover {
		color: var(--color-amber);
	}
	.sentinel {
		height: 1px;
	}
	.status {
		min-height: 24px;
		padding: 28px 0 0;
		font-size: 16px;
		letter-spacing: 0.08em;
		text-align: center;
	}
	.status button {
		font: inherit;
		color: var(--color-amber);
		background: none;
		border: 0;
		cursor: pointer;
		text-decoration: underline;
	}
	@media (max-width: 720px) {
		.page,
		.page.with-timeline {
			padding: 8px 16px 40px;
		}
	}
</style>
