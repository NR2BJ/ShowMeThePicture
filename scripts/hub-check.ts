// 허브 보정 점검 (개발용): 질의 하나에 대해 SQL 경로(nearest)와 JS 기준 구현(hubAdjust)이 같은 값·순서를 내는지 확인하고,
// 보정이 순서를 얼마나 바꾸는지 보여준다. 작은 라이브러리에서도 보정 경로를 타도록 minCenter=1.
//   node --env-file-if-exists=.env --import tsx scripts/hub-check.ts "바다와 배"
import { eq } from 'drizzle-orm';
import { getDb } from '#lib/server/db/index.ts';
import { embeddings, photos } from '#lib/server/db/schema.ts';
import { loadConfig } from '#lib/server/env.ts';
import { embedText, normalizeNllbLang, type MlConfig } from '#lib/server/ml.ts';
import { libraryCenter, nearest } from '#lib/server/nearest.ts';
import { getSetting } from '#lib/server/settings.ts';
import { cosine, DEFAULT_SEARCH_MODEL, hubAdjust } from '#lib/search.ts';

const text = process.argv[2] ?? '바다와 배';
const env = loadConfig(process.env);
const db = getDb(env.DATABASE_URL!);
const cfg: MlConfig = {
	url: env.ML_URL,
	model: await getSetting<string>(db, 'search_model', DEFAULT_SEARCH_MODEL),
	language: normalizeNllbLang(await getSetting<string>(db, 'search_language', 'ko'))
};
const q = await embedText(cfg, text);
const rows = await db
	.select({ photoId: photos.id, vec: embeddings.embedding })
	.from(embeddings)
	.innerJoin(photos, eq(photos.primaryFileId, embeddings.fileId))
	.where(eq(embeddings.model, cfg.model));
if (rows.length === 0) {
	console.log('임베딩이 없습니다');
	process.exit(1);
}
const dim = rows[0].vec.length;
const mu = new Array<number>(dim).fill(0);
for (const r of rows) for (let i = 0; i < dim; i++) mu[i] += r.vec[i] / rows.length;
const ai = new Map(rows.map((r) => [r.photoId, cosine(r.vec, mu)]));
const abar = [...ai.values()].reduce((a, b) => a + b, 0) / rows.length;
const cq = cosine(q, mu);
const js = rows
	.map((r) => {
		const raw = cosine(q, r.vec);
		return { id: r.photoId, raw, adj: hubAdjust(raw, cq, ai.get(r.photoId)!, abar) };
	})
	.sort((a, b) => b.adj - a.adj);
const c = await libraryCenter(db, cfg.model, 1);
const muErr = Math.max(...mu.map((v, i) => Math.abs(v - (c.mu?.[i] ?? NaN))));
console.log(
	`model=${cfg.model} n=${rows.length} cq=${cq.toFixed(4)} abar js=${abar.toFixed(5)} sql=${c.abar.toFixed(5)} |μ diff|max=${muErr.toExponential(2)}`
);
const hits = await nearest(db, { admin: true, model: cfg.model, vec: q, limit: 60, minCenter: 1 });
let maxErr = 0;
let orderOk = true;
hits.forEach((h, i) => {
	if (js[i].id !== h.id) orderOk = false;
	const ref = js.find((x) => x.id === h.id)?.adj ?? NaN;
	maxErr = Math.max(maxErr, Math.abs(1 - h.dist - ref));
});
console.log(`hits=${hits.length} same order=${orderOk} max|sql−js|=${maxErr.toExponential(2)}`);
const rawOrder = [...js].sort((a, b) => b.raw - a.raw);
const moved = js.filter((x, i) => rawOrder[i].id !== x.id).length;
console.log(`보정으로 자리가 바뀐 사진: ${moved}/${js.length}`);
console.log('순위  원시 → 보정   (중심 성분 ai)');
js.slice(0, 10).forEach((x, i) =>
	console.log(
		`${String(i + 1).padStart(3)}  ${x.raw.toFixed(4)} → ${x.adj.toFixed(4)}  (${ai.get(x.id)!.toFixed(3)})  ${x.id}`
	)
);
process.exit(0);
