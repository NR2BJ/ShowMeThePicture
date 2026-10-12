<script lang="ts">
	import type { PageProps } from './$types';
	let { data }: PageProps = $props();
	const max = $derived(Math.max(1, ...data.daily.map((d) => Math.max(d.visitors, d.views))));
	// 0 이면 막대 없음, 아주 작아도 2px 는 보이게
	const w = (v: number) => (v ? `max(2px, ${(v / max) * 100}%)` : '0');
	const md = (day: string) => `${Number(day.slice(5, 7))}.${Number(day.slice(8, 10))}`;
	const wd = (day: string) => '일월화수목금토'[new Date(`${day}T00:00:00Z`).getUTCDay()];
</script>

<!-- 관리자만 보는 숫자. 손님 화면에는 어디에도 나오지 않는다. -->
<section class="admin-page">
	<h1>방문</h1>

	<div class="counter mono" aria-label="방문자 수">
		<span><b>TODAY</b> {data.summary.today}</span>
		<span class="sep">|</span>
		<span><b>TOTAL</b> {data.summary.total}</span>
		<span class="dim small"
			>어제 {data.summary.yesterday} · 사진 조회 오늘 {data.summary.viewsToday} · 전체 {data.summary
				.viewsTotal}</span
		>
	</div>

	<p class="dim note">
		한 사람은 하루 한 번만 셉니다(사이트 방문, 사진마다 조회). 페이지를 실제로 2초 넘게 본
		브라우저만 세므로 검색엔진·링크 미리보기·스캐너 같은 봇은 빠집니다. 관리자로 로그인한 적 있는
		브라우저도 세지 않습니다. 지금 이 브라우저도 마찬가지입니다. IP 같은 개인정보는 저장하지
		않습니다.
	</p>

	<h2>최근 30일</h2>
	<div class="legend mono dim"><i class="sw v"></i>방문자 <i class="sw p"></i>사진 조회</div>
	<ol class="days mono">
		{#each data.daily as d (d.day)}
			<li>
				<span class="dd" class:weekend={wd(d.day) === '일' || wd(d.day) === '토'}
					>{md(d.day)} <small>{wd(d.day)}</small></span
				>
				<span class="bars">
					<span class="bar v" style:width={w(d.visitors)}></span>
					<span class="bar p" style:width={w(d.views)}></span>
				</span>
				<span class="nums">{d.visitors} <span class="dim">/ {d.views}</span></span>
			</li>
		{/each}
	</ol>

	{#each [['최근 7일 많이 본 사진', data.week], ['전체 많이 본 사진', data.all]] as const as [title, list] (title)}
		<h2>{title}</h2>
		{#if list.length === 0}
			<p class="dim">아직 없습니다.</p>
		{:else}
			<ul class="top">
				{#each list as t (t.id)}
					<li>
						<a href={`/p/${t.id}`}><img src={t.thumb} alt="" loading="lazy" /></a>
						<span class="mono dim">{t.views}회</span>
					</li>
				{/each}
			</ul>
		{/if}
	{/each}
</section>

<style>
	.counter {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 8px 14px;
		font-size: 22px;
		margin: 4px 0 12px;
	}
	.counter b {
		color: var(--color-amber);
		font-weight: 500;
		font-size: 15px;
		letter-spacing: 0.08em;
		margin-right: 4px;
	}
	.counter .sep {
		color: var(--color-ink-faint);
	}
	.counter .small {
		font-size: 14px;
		flex-basis: 100%;
	}
	.note {
		max-width: 60ch;
		font-size: 14px;
		line-height: 1.6;
		margin-bottom: 28px;
	}
	.legend {
		display: flex;
		align-items: center;
		gap: 6px 10px;
		font-size: 13px;
		margin-bottom: 8px;
	}
	.sw {
		display: inline-block;
		width: 12px;
		height: 8px;
	}
	.sw.v,
	.bar.v {
		background: var(--color-amber);
	}
	.sw.p,
	.bar.p {
		background: var(--color-ink-faint);
	}
	.days {
		list-style: none;
		padding: 0;
		margin: 0 0 32px;
		font-size: 13px;
	}
	.days li {
		display: grid;
		grid-template-columns: 64px 1fr 76px;
		align-items: center;
		gap: 10px;
		padding: 2px 0;
	}
	.dd small {
		color: var(--color-ink-faint);
	}
	.dd.weekend small {
		color: var(--color-amber);
	}
	.bars {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.bar {
		display: block;
		height: 5px;
	}
	.nums {
		text-align: right;
	}
	.top {
		list-style: none;
		padding: 0;
		margin: 0 0 32px;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
		gap: 12px;
	}
	.top li {
		display: flex;
		flex-direction: column;
		gap: 4px;
		font-size: 13px;
	}
	.top img {
		display: block;
		width: 100%;
		aspect-ratio: 3 / 2;
		object-fit: cover;
		background: #000;
	}
</style>
