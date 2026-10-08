# ShowMeThePicture

셀프 호스팅 사진 포트폴리오. 원본 스토리지를 그대로 읽고(read-only), 보정본 중심으로 보여주되 버튼 하나로 원본과 전환하며, 한글 시맨틱 검색이 된다. 설계는 [docs/DESIGN.md](docs/DESIGN.md).

레포: https://github.com/NR2BJ/ShowMeThePicture · 이미지: `ghcr.io/nr2bj/showmethepicture`

## 스택

SvelteKit 3(Svelte 5) · TypeScript · Tailwind v4 · PostgreSQL 17 + pgvector · Drizzle · pg-boss · sharp · exiftool-vendored · Immich machine-learning(OpenVINO, Intel Arc). TLS·도메인은 외부 reverse proxy(Caddy 등)

## 설정의 경계

- **compose + 환경변수 = 인프라만**: 마운트 경로, DB 비밀번호, 도메인/ORIGIN, 이미지 태그. ([.env.example](.env.example))
- **관리자 페이지 = 앱 설정 전부**: 사진 폴더(Source) 등록, 사이트 제목, 공개 정책, 검색 모델 … DB 볼륨에 저장되어 재배포해도 유지된다.
- `PHOTOS_HOST_PATH` 는 넓게(풀 전체나 `photo123` 의 부모) 한 번만 마운트하고, 실제 폴더는 앱의 폴더 선택기로 `/photos` 아래에서 고른다. 폴더를 더 등록할 때 compose 를 건드리지 않는다.

## 배포 (Debian + Docker, Portainer)

1. `main` 에 push 하면 GitHub Actions 가 `ghcr.io/nr2bj/showmethepicture:latest` 를 만든다 (`sha-…`, `v*` 태그도). 레포가 public 이라 pull 에 인증이 필요 없다.
2. Portainer → Stacks → Add stack → **Web editor** 에 [compose.yaml](compose.yaml) 을 붙여넣는다. `${...}` 자리는 아래 Environment variables 에 넣어도 되고 그냥 값으로 바꿔 써도 된다 (`PHOTOS_HOST_PATH`, `CACHE_HOST_PATH`, `POSTGRES_PASSWORD`, `ORIGIN`, 필요하면 `APP_PORT`). 이후 수정도 Portainer 에서 바로 한다. 레포의 compose 는 템플릿일 뿐 고정이 아니다.
3. 외부 reverse proxy(예: Proxmox LXC 의 Caddy)에서 도메인을 app 으로 넘긴다. `ORIGIN` 은 이 공개 URL 과 같아야 한다.
   ```
   photos.example.com {
       encode zstd gzip
       reverse_proxy <Debian VM IP>:3000
   }
   ```
   외부 프록시가 없으면 [compose.caddy.yaml](compose.caddy.yaml) 을 겹쳐 스택 안에서 TLS 까지 처리한다.
4. 새 이미지가 올라오면 스택에서 **Pull and redeploy**. 자동화하고 싶으면 대신 Repository 스택(GitOps)으로 만들고 스택 webhook URL 을 레포 Secrets `PORTAINER_WEBHOOK` 에 넣으면 빌드 직후 재배포된다.
5. 서버에서 직접 돌릴 때
   ```bash
   cp .env.example .env     # 값 채우기. CACHE_HOST_PATH 는 SSD!
   docker compose up -d     # GHCR 이미지 pull
   # 소스에서 직접 빌드할 때만:
   docker compose -f compose.yaml -f compose.build.yaml up -d --build
   ```
6. 첫 실행 후 관리자로 로그인해 라이브러리에서 폴더를 Source 로 등록한다.

컨테이너: `db`, `app`(SSR + API + `/media/*` 서빙, 기동 시 마이그레이션), `worker`(스캔·메타·파생본·페어링), `ml`(Immich ML, `/dev/dri`). 파생 이미지는 app 이 공개 여부를 확인하고 스트리밍하므로 비공개 사진의 썸네일이 id 만으로 새지 않는다. `compose.yaml` 에는 `build:` 가 없다 — 웹 에디터 스택은 빌드 컨텍스트가 없어서 넣으면 실패한다. 로컬 빌드는 `compose.build.yaml` override 로.

## 로컬 개발 (Mac)

```bash
pnpm install
cat > .env <<'ENV'
DATABASE_URL=postgres://smtp:smtp@localhost:5432/smtp   # 없으면 랜딩이 빈 상태로 뜬다
PHOTOS_ROOT=/Users/me/Pictures/test
CACHE_DIR=./data/cache
ENV
pnpm dev
```

- `pnpm check` 타입 검사 · `pnpm build` 프로덕션 빌드 · `pnpm format`
- `pnpm db:generate` 스키마 → 마이그레이션 SQL · `pnpm db:migrate` 적용
- `pnpm test:schema` PGlite(인메모리 Postgres)로 마이그레이션 SQL 검증. 실제 DB 없이 돈다.
- `pnpm worker` 잡 워커 (Postgres 필요)

## 구조

```
src/routes/            페이지와 API (+page.svelte, +server.ts)
src/lib/components/    Header, FilmStrip, …
src/lib/server/        env/config, db(schema, migrate), photos 쿼리
src/worker/            pg-boss 워커 진입점
src/env.ts             환경변수 정의 (SvelteKit 3 defineEnvVars)
drizzle/               생성된 마이그레이션 SQL
docker/                Dockerfile (compose.build.yaml 이 참조)
.github/workflows/     GHCR 이미지 빌드
docs/                  설계 문서, 목업
```

## 코드 규칙 (SvelteKit 3 기준)

- `src/lib` 는 `#lib/...` 로 import 한다(`$lib` 은 Kit 3 에서 제거됨). `.ts` 파일은 **확장자까지** 쓴다: `#lib/server/photos.ts`. Node(worker, 스크립트)와 TypeScript 양쪽에서 같은 경로가 통하게 하기 위함.
- 환경변수는 `src/env.ts` 에서 `defineEnvVars` 로 정의하고, 서버 코드는 `#lib/server/config.ts`(= `$app/env/private`)를 쓴다. 검증 규칙은 `src/lib/server/env.ts`(zod) 하나이며 worker/스크립트는 `loadConfig(process.env)` 로 같은 규칙을 탄다. `$env/*` 는 Kit 3 에 없다.
- 서버 전용 코드는 `src/lib/server/` 아래. 클라이언트로 새지 않는다.
- Svelte 5 runes 모드 강제(`vite.config.ts`). `export let` / `$:` 대신 `$props()` / `$derived` / `$state`.
- DB 스키마는 `src/lib/server/db/schema.ts` 가 원본. 바꾸면 `pnpm db:generate` → 생성된 SQL 확인 → `pnpm test:schema` 로 PGlite 검증. 첫 마이그레이션에만 `CREATE EXTENSION vector, pg_trgm` 이 수동으로 들어가 있다.
- 포맷은 prettier(`pnpm format`), 탭 들여쓰기, 작은따옴표.
- 의존성 빌드 스크립트 허용은 `pnpm-workspace.yaml` 의 `allowBuilds` 로 한다(pnpm 11+에서 `onlyBuiltDependencies` 는 제거됨). CI(`CI=true pnpm install --frozen-lockfile`)는 허용 안 된 빌드 스크립트가 있으면 실패한다.
