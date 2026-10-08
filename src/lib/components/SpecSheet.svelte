<script lang="ts">
	import type { Variant } from '#lib/server/gallery.ts';

	let {
		variant,
		showGps = false,
		admin = false
	}: { variant: Variant; showGps?: boolean; admin?: boolean } = $props();

	const fmtDate = (iso: string | null) =>
		iso
			? new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }).format(
					new Date(iso)
				)
			: null;
	const mb = (n: number) => (n / 1024 / 1024).toFixed(1) + ' MB';
	const srcLabel: Record<string, string> = {
		exif: 'EXIF',
		xmp: 'XMP',
		folder: '폴더명',
		roll: '롤 정보',
		mtime: '파일 수정시각',
		manual: '수동'
	};

	let showAll = $state(false);
	const groups = $derived.by(() => {
		const v = variant;
		const g: { title: string; rows: [string, string | null][] }[] = [
			{
				title: '촬영',
				rows: [
					['시각', fmtDate(v.takenAt)],
					['출처', v.takenAtSource ? (srcLabel[v.takenAtSource] ?? v.takenAtSource) : null]
				]
			},
			{
				title: '카메라',
				rows: [
					['제조사', v.cameraMake],
					['기종', v.cameraModel],
					['렌즈', v.lens]
				]
			},
			{
				title: '노출',
				rows: [
					['초점거리', v.focalLengthMm ? `${v.focalLengthMm} mm` : null],
					['조리개', v.fNumber ? `f/${v.fNumber}` : null],
					['셔터', v.exposureTime ? `${v.exposureTime} s` : null],
					['ISO', v.iso ? String(v.iso) : null]
				]
			},
			{
				title: '파일',
				rows: [
					['이름', v.filename],
					['형식', `${v.kind} · ${v.ext.toUpperCase()}`],
					['크기', `${v.width ?? '?'} × ${v.height ?? '?'} · ${mb(v.size)}`],
					['색공간', v.colorProfile],
					['라이브러리', v.source.name],
					['경로', admin ? v.relPath : null],
					['해시', v.contentHash ? v.contentHash.slice(0, 12) : null]
				]
			}
		];
		if (showGps && v.gpsLat != null && v.gpsLon != null) {
			g.push({ title: '위치', rows: [['좌표', `${v.gpsLat.toFixed(5)}, ${v.gpsLon.toFixed(5)}`]] });
		}
		if (v.rating || v.keywords?.length || v.title || v.caption) {
			g.push({
				title: '설명',
				rows: [
					['제목', v.title],
					['캡션', v.caption],
					['별점', v.rating ? '★'.repeat(v.rating) : null],
					['키워드', v.keywords?.length ? v.keywords.join(', ') : null]
				]
			});
		}
		return g.map((x) => ({ ...x, rows: x.rows.filter((r) => r[1]) })).filter((x) => x.rows.length);
	});
	const all = $derived(
		Object.entries(variant.metadata ?? {}).sort(([a], [b]) => a.localeCompare(b))
	);
</script>

<div class="sheet">
	{#each groups as g (g.title)}
		<section>
			<h3>{g.title}</h3>
			<dl>
				{#each g.rows as [k, v] (k)}
					<dt>{k}</dt>
					<dd>{v}</dd>
				{/each}
			</dl>
		</section>
	{/each}
	{#if all.length}
		<section>
			<button type="button" class="more" onclick={() => (showAll = !showAll)}>
				{showAll ? '모든 메타데이터 접기' : `모든 메타데이터 보기 (${all.length})`}
			</button>
			{#if showAll}
				<dl class="all">
					{#each all as [k, v] (k)}
						<dt>{k}</dt>
						<dd>{Array.isArray(v) ? v.join(', ') : String(v)}</dd>
					{/each}
				</dl>
			{/if}
		</section>
	{/if}
</div>

<style>
	.sheet {
		font-family: var(--font-mono);
		font-size: 12px;
		letter-spacing: 0.02em;
		font-variant-numeric: tabular-nums;
	}
	section {
		margin: 0 0 22px;
	}
	h3 {
		margin: 0 0 8px;
		font-weight: 500;
		font-size: 10px;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--color-amber);
	}
	dl {
		display: grid;
		grid-template-columns: 88px 1fr;
		gap: 4px 12px;
		margin: 0;
	}
	dt {
		color: var(--color-ink-dim);
	}
	dd {
		margin: 0;
		overflow-wrap: anywhere;
	}
	dl.all {
		grid-template-columns: minmax(120px, 40%) 1fr;
		max-height: 50vh;
		overflow: auto;
		padding-top: 8px;
		border-top: 1px solid var(--color-ink-faint);
		margin-top: 8px;
	}
	.more {
		background: none;
		border: 0;
		padding: 0;
		color: var(--color-ink-dim);
		font: inherit;
		cursor: pointer;
	}
	.more:hover {
		color: var(--color-ink);
	}
</style>
