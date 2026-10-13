<script lang="ts">
	// 아카이브 필터 바: 매체·컷은 집합 토글(비어 있음 = 전체), 카메라·렌즈·필름은 하나 고르기. 바꾸면 주소가 바뀌고 목록이 처음부터 다시 선다.
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import {
		KINDS,
		KIND_LABEL,
		MEDIUMS,
		MEDIUM_LABEL,
		archiveHref,
		isFilterActive,
		type ArchiveFacets,
		type ArchiveFilter,
		type KindKey,
		type MediumKey
	} from '#lib/archive.ts';

	// hrefFor: 필터 → 주소 (기본은 /archive; 검색 페이지는 검색어·보기를 붙인 /search 주소)
	let {
		filter,
		facets,
		hrefFor = (f: ArchiveFilter) => archiveHref(f)
	}: {
		filter: ArchiveFilter;
		facets: ArchiveFacets;
		hrefFor?: (f: ArchiveFilter) => string;
	} = $props();

	function apply(next: ArchiveFilter) {
		void goto(hrefFor(next));
	}
	// 집합 토글: 아무것도 안 골랐으면(전체) 누른 것만, 이미 고른 걸 다시 누르면 빼고, 전부 고르면 다시 전체
	function toggle<T extends string>(
		all: readonly T[],
		cur: T[] | undefined,
		v: T
	): T[] | undefined {
		const set = new Set(cur ?? []);
		if (set.size === 0) return [v];
		if (set.has(v)) set.delete(v);
		else set.add(v);
		return set.size === 0 || set.size === all.length ? undefined : all.filter((x) => set.has(x));
	}
	const mediumOn = (m: MediumKey) => !!filter.medium?.length && filter.medium.includes(m);
	const kindOn = (k: KindKey) => !!filter.kind?.length && filter.kind.includes(k);
	function pick(key: 'camera' | 'lens' | 'film', e: Event) {
		const v = (e.currentTarget as HTMLSelectElement).value;
		apply({ ...filter, [key]: v || undefined });
	}
	const active = $derived(isFilterActive(filter));
	// 컷(A/B/원본만) 축은 관리자용 — 게스트에게는 숨긴다
	const admin = $derived(!!(page.data as { admin?: unknown }).admin);
	// 0장인 선택지는 숨긴다(고른 것은 남김). 고를 게 하나뿐인 묶음·선택 상자는 통째로 숨긴다
	// (예: F31fd 폴더에서는 매체가 디지털뿐이라 매체 묶음이 없다. 원본만 폴더라도 직접 A/B 로 올린 사진이 있으면 A/B 가 보인다)
	const mediums = $derived(MEDIUMS.filter((m) => facets.medium[m] > 0 || mediumOn(m)));
	const kinds = $derived(KINDS.filter((k) => facets.kind[k] > 0 || kindOn(k)));
	// 고른 필터 수 (폰에서 접힌 버튼에 표시)
	const activeCount = $derived(
		(filter.medium?.length ? 1 : 0) +
			(admin && filter.kind?.length ? 1 : 0) +
			(filter.camera ? 1 : 0) +
			(filter.lens ? 1 : 0) +
			(filter.film ? 1 : 0)
	);
	// 폰에서는 접어 두고 버튼으로 연다 (넓은 화면은 늘 펼침 — CSS)
	let open = $state(false);
</script>

<button
	type="button"
	class="toggle mono"
	class:on={active}
	aria-expanded={open}
	onclick={() => (open = !open)}
	>필터{#if activeCount}&nbsp;· {activeCount}{/if}
	<span aria-hidden="true">{open ? '▴' : '▾'}</span></button
>
<div class="filters mono" class:open aria-label="필터">
	{#if mediums.length > 1}
		<div class="group" role="group" aria-label="매체">
			{#each mediums as m (m)}
				<button
					type="button"
					class="chip"
					class:on={mediumOn(m)}
					class:empty={!facets.medium[m]}
					aria-pressed={mediumOn(m)}
					onclick={() => apply({ ...filter, medium: toggle(MEDIUMS, filter.medium, m) })}
					>{MEDIUM_LABEL[m]} <span class="n">{facets.medium[m]}</span></button
				>
			{/each}
		</div>
	{/if}
	{#if admin && kinds.length > 1}
		<div class="group" role="group" aria-label="컷">
			{#each kinds as k (k)}
				<button
					type="button"
					class="chip"
					class:on={kindOn(k)}
					class:empty={!facets.kind[k]}
					aria-pressed={kindOn(k)}
					onclick={() => apply({ ...filter, kind: toggle(KINDS, filter.kind, k) })}
					>{KIND_LABEL[k]} <span class="n">{facets.kind[k]}</span></button
				>
			{/each}
		</div>
	{/if}
	{#each [['camera', '카메라', facets.camera, filter.camera], ['lens', '렌즈', facets.lens, filter.lens], ['film', '필름', facets.film, filter.film]] as const as [key, label, values, cur] (key)}
		<!-- 값이 하나뿐이면 숨김 (단일 카메라 폴더, 고정렌즈 카메라를 고른 뒤의 렌즈 등) -->
		{#if cur || values.length > 1}
			<label class="pick">
				<span>{label}</span>
				<!-- 선택은 select 의 value 로 맞춘다 — option 의 selected 속성만 바꾸면, 사용자가 한 번 직접 고른 상자는
				     브라우저가 그 속성 변화를 무시해 '필터 지우기' 뒤에도 예전 장비가 칸에 남았다 -->
				<select value={cur ?? ''} onchange={(e) => pick(key, e)}>
					<option value="">전체</option>
					{#each values as c (c.v)}
						<option value={c.v}>{c.v} ({c.n})</option>
					{/each}
					{#if cur && !values.some((c) => c.v === cur)}
						<option value={cur}>{cur} (0)</option>
					{/if}
				</select>
			</label>
		{/if}
	{/each}
	{#if active}<a class="clear" href={hrefFor({})}>필터 지우기</a>{/if}
</div>

<style>
	.filters {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px 18px;
		margin: -8px 0 32px;
		font-size: 15px;
		letter-spacing: 0.06em;
	}
	.group {
		display: flex;
		gap: 6px;
	}
	.chip {
		font: inherit;
		letter-spacing: inherit;
		color: var(--color-ink-dim);
		background: transparent;
		border: 1px solid var(--color-ink-faint);
		padding: 5px 10px;
		cursor: pointer;
		transition:
			color 0.15s ease,
			border-color 0.15s ease;
	}
	.chip:hover {
		color: var(--color-ink);
	}
	.chip.on {
		color: var(--color-amber);
		border-color: var(--color-amber);
	}
	.chip.empty:not(.on) {
		opacity: 0.45;
	}
	.n {
		color: var(--color-ink-faint);
		margin-left: 2px;
	}
	.chip.on .n {
		color: var(--color-amber);
		opacity: 0.7;
	}
	.pick {
		display: flex;
		align-items: center;
		gap: 8px;
		color: var(--color-ink-dim);
	}
	.pick select {
		font: inherit;
		letter-spacing: inherit;
		color: var(--color-ink);
		background: var(--color-bg);
		border: 1px solid var(--color-ink-faint);
		padding: 5px 8px;
		max-width: 260px;
	}
	.toggle {
		display: none;
	}
	/* 폰: 필터는 버튼으로 접고, 장비 선택은 한 줄씩 같은 폭으로 */
	@media (max-width: 720px) {
		.toggle {
			display: inline-flex;
			gap: 8px;
			font-size: 15px;
			letter-spacing: 0.06em;
			color: var(--color-ink-dim);
			background: transparent;
			border: 1px solid var(--color-ink-faint);
			padding: 6px 12px;
			margin: -8px 0 16px;
			cursor: pointer;
		}
		.toggle.on {
			color: var(--color-amber);
			border-color: var(--color-amber);
		}
		.filters {
			display: none;
			gap: 10px;
			margin-top: 0;
		}
		.filters.open {
			display: flex;
		}
		.pick {
			width: 100%;
		}
		.pick span {
			flex: none;
			width: 3.5em;
		}
		.pick select {
			flex: 1;
			min-width: 0;
			max-width: none;
		}
	}
	.clear {
		color: var(--color-ink-dim);
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	.clear:hover {
		color: var(--color-amber);
	}
</style>
