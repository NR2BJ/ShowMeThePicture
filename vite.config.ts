import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// 프로젝트 코드는 전부 runes 모드. node_modules 안의 라이브러리는 제외.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			// 배포는 Docker 안의 Node 서버 (docker/app.Dockerfile 참고)
			adapter: adapter({ out: 'build' })
		})
	]
});
