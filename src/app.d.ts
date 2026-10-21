// https://svelte.dev/docs/kit/types#app.d.ts
declare global {
	namespace App {
		interface Locals {
			/** 관리자 세션 (4단계에서 hooks.server.ts 가 채운다) */
			admin: { id: string; username: string } | null;
		}
		interface Error {
			/** 서버 로그에서 찾을 짧은 오류 번호 (hooks 의 handleError) */
			id?: string;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
