// 로컬 개발용 가짜 ML 서버: Immich ML 의 /ping, /predict 흉내. 입력 바이트/글자의 해시로 만든 결정적 768차원 벡터를 "[…]" 문자열로 돌려준다.
// 실행: node --import tsx scripts/fake-ml.ts (포트 3003). 검색 결과는 의미가 없지만 파이프라인은 끝까지 돈다.
import { createHash } from 'node:crypto';
import http from 'node:http';
import { Readable } from 'node:stream';

const DIM = 768;
function vecFrom(seed: Uint8Array): number[] {
	const out: number[] = [];
	let h = createHash('sha256').update(seed).digest();
	while (out.length < DIM) {
		for (let i = 0; i + 1 < h.length && out.length < DIM; i += 2)
			out.push(((h[i] << 8) | h[i + 1]) / 65535 - 0.5);
		h = createHash('sha256').update(h).digest();
	}
	const n = Math.hypot(...out) || 1;
	return out.map((x) => x / n);
}

const server = http.createServer(async (req, res) => {
	if (req.method === 'GET' && req.url === '/ping') return void res.end('pong');
	if (req.method !== 'POST' || !req.url?.startsWith('/predict')) {
		res.statusCode = 404;
		return void res.end('not found');
	}
	try {
		const fd = await new Response(Readable.toWeb(req) as ReadableStream, {
			headers: { 'content-type': req.headers['content-type'] ?? '' }
		}).formData();
		const entries = JSON.parse(String(fd.get('entries') ?? '{}'));
		const image = fd.get('image');
		const text = fd.get('text');
		let seed: Uint8Array;
		if (image instanceof Blob) seed = new Uint8Array(await image.arrayBuffer());
		else if (typeof text === 'string') seed = new TextEncoder().encode(text);
		else {
			res.statusCode = 400;
			return void res.end('Either image or text must be provided');
		}
		const vec = vecFrom(seed);
		res.setHeader('content-type', 'application/json');
		res.end(
			JSON.stringify({
				clip: JSON.stringify(vec),
				...(image ? { imageWidth: 3, imageHeight: 2 } : {}),
				_model: entries
			})
		);
	} catch (e) {
		res.statusCode = 500;
		res.end(String(e));
	}
});
server.listen(Number(process.env.PORT ?? 3003), '127.0.0.1', () =>
	console.log(`fake ml on http://127.0.0.1:${process.env.PORT ?? 3003}`)
);
