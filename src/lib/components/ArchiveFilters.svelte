<script lang="ts">
	// 아카이브 필터 바: 매체·컷은 집합 토글(비어 있음 = 전체), 카메라·렌즈·필름은 하나 고르기. 바꾸면 주소가 바뀌고 목록이 처음부터 다시 선다.
	import { goto } from '$app/navigation';
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

	let { filter, facets }: { filter: ArchiveFilter; facets: ArchiveFacets } = $props();

	function apply(next: ArchiveFilter) {
		void goto(archiveHref(next));
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
</script>

<div class="filters mono" aria-label="필터">
	<div class="group" role="group" aria-label="매체">
		{#each MEDIUMS as m (m)}
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
	<div class="group" role="group" aria-label="컷">
		{#each KINDS as k (k)}
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
	{#each [['camera', '카메라', facets.camera, filter.camera], ['lens', '렌즈', facets.lens, filter.lens], ['film', '필름', facets.film, filter.film]] as const as [key, label, values, cur] (key)}
		{#if values.length > 0 || cur}
			<label class="pick">
				<span>{label}</span>
				<select onchange={(e) => pick(key, e)}>
					<option value="">전체</option>
					{#each values as c (c.v)}
						<option value={c.v} selected={cur === c.v}>{c.v} ({c.n})</option>
					{/each}
					{#if cur && !values.some((c) => c.v === cur)}
						<option value={cur} selected>{cur} (0)</option>
					{/if}
				</select>
			</label>
		{/if}
	{/each}
	{#if active}<a class="clear" href="/archive">필터 지우기</a>{/if}
</div>

<style>
	.filters {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px 18px;
		margin: -8px 0 32px;
		font-size: 12px;
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
	.clear {
		color: var(--color-ink-dim);
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	.clear:hover {
		color: var(--color-amber);
	}
</style>
