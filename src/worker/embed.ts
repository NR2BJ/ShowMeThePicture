// 임베딩 잡: 파일의 preview 파생본을 ML 에 보내 벡터를 저장한다. 사진의 primary 파일만 대상(검색·유사 사진이 그걸 쓴다).
import path from 'node:path';
import { readFile, stat } from 'node:fs/promises';
import { eq } from 'drizzle-orm';
import { DEFAULT_SEARCH_MODEL } from '#lib/search.ts';
import { embeddings, files, photos, sources } from '#lib/server/db/schema.ts';
import { ensureDerivative } from '#lib/server/derive.ts';
import { derivativePath } from '#lib/server/media.ts';
import { embedImage, type MlConfig } from '#lib/server/ml.ts';
import { getSetting } from '#lib/server/settings.ts';
import type { ProcessCtx } from './process.ts';

export type EmbedCtx = ProcessCtx & { mlUrl: string };

export async function embedFile(
	ctx: EmbedCtx,
	fileId: string
): Promise<'done' | 'skipped' | 'not-primary'> {
	const { db } = ctx;
	const [row] = await db
		.select({ f: files, rootPath: sources.rootPath })
		.from(files)
		.innerJoin(sources, eq(sources.id, files.sourceId))
		.where(eq(files.id, fileId))
		.limit(1);
	if (!row || row.f.status !== 'active' || !row.f.derivativesReady) return 'skipped';
	// primary 가 아닌 변형(RAW 원본 옆의 JPG 등)은 건너뛴다
	const [p] = await db
		.select({ id: photos.id })
		.from(photos)
		.where(eq(photos.primaryFileId, fileId))
		.limit(1);
	if (!p) return 'not-primary';
	const model = await getSetting<string>(db, 'search_model', DEFAULT_SEARCH_MODEL);
	const [ex] = await db
		.select({ model: embeddings.model, at: embeddings.updatedAt })
		.from(embeddings)
		.where(eq(embeddings.fileId, fileId))
		.limit(1);
	// 같은 모델이고 미리보기보다 나중에 만든 임베딩이면 건너뛴다. 미리보기가 더 새로우면(덮어쓴 파일·방향 저장으로
	// 다시 처리됨) 사진이 바뀐 것이라 다시 만든다 — 예전엔 모델만 봐서 옛 사진 기준 임베딩이 남았다.
	if (ex?.model === model) {
		const p = await stat(derivativePath(ctx.cacheDir, fileId, 'preview')).catch(() => null);
		if (!p || p.mtimeMs <= ex.at.getTime() + 60_000) return 'skipped';
	}
	const cfg: MlConfig = { url: ctx.mlUrl, model, language: null };
	const preview = await ensureDerivative(
		ctx.exiftool,
		ctx.cacheDir,
		{
			id: row.f.id,
			kind: row.f.kind,
			absPath: path.join(row.rootPath, row.f.relPath),
			rotation: row.f.rotation
		},
		'preview'
	);
	const vec = await embedImage(cfg, new Uint8Array(await readFile(preview)));
	await db
		.insert(embeddings)
		.values({ fileId, model, dim: vec.length, embedding: vec })
		.onConflictDoUpdate({
			target: embeddings.fileId,
			set: { model, dim: vec.length, embedding: vec, updatedAt: new Date() }
		});
	return 'done';
}
