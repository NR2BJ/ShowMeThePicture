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
2. Portainer → Stacks → Add stack → **Web editor** 에 [compose.yaml](compose.yaml) 을 붙여넣는다. `${...}` 자리는 아래 Environment variables 에 넣어도 되고 그냥 값으로 바꿔 써도 된다 (`PHOTOS_HOST_PATH`, `CACHE_HOST_PATH`, `POSTGRES_PASSWORD`, `ORIGIN`, `RENDER_GID` = `stat -c %g /dev/dri/renderD128` 의 값, 필요하면 `APP_PORT`, `ML_MODEL_TTL`). 이후 수정도 Portainer 에서 바로 한다. 레포의 compose 는 템플릿일 뿐 고정이 아니다.
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

Postgres 17 + pgvector 가 필요하다 (Docker 없이 Homebrew):

```bash
brew install pgvector postgresql@17          # pgvector 가 postgresql@17 에 묶인다
LC_ALL=C /opt/homebrew/opt/postgresql@17/bin/pg_ctl -D /opt/homebrew/var/postgresql@17 -o "-p 5432" start
psql -h localhost -d postgres -c "create role smtp login password 'smtp' createdb;" -c "create database smtp owner smtp;"
psql -h localhost -d smtp -c "create extension vector; create extension pg_trgm;"
```

(macOS 에서 `LC_ALL` 없이 띄우면 "postmaster became multithreaded" 로 죽는다.)

```bash
pnpm install
cat > .env <<'ENV'
DATABASE_URL=postgres://smtp:smtp@localhost:5432/smtp
PHOTOS_ROOT=/absolute/path/to/data/test-photos
CACHE_DIR=/absolute/path/to/data/cache
ENV
pnpm db:migrate
node --import tsx scripts/make-test-photos.ts   # 합성 테스트 사진 28장 (nx500/f31fd/film/edited A·B)
pnpm dev                                        # http://127.0.0.1:5173
pnpm worker                                     # 다른 터미널에서. 스캔·메타·파생본 처리
```

첫 접속에서 `/admin/setup` 으로 관리자를 만들고, `/admin/sources` 에서 폴더를 등록하면 워커가 스캔한다.
`node --import tsx scripts/dev-seed-sources.ts` 는 테스트 폴더들을 한 번에 등록한다.

- `pnpm check` 타입 검사 · `pnpm test` 단위 테스트(vitest) · `pnpm build` 프로덕션 빌드 · `pnpm format`
- `pnpm db:generate` 스키마 → 마이그레이션 SQL · `pnpm db:migrate` 적용
- `pnpm test:schema` PGlite(인메모리 Postgres)로 마이그레이션 SQL 검증. 실제 DB 없이 돈다.

## 동작 (1단계 기준)

- 관리자: `/admin/setup`(첫 계정) → `/admin/login` → `/admin`(대시보드: 사진·페어링·폴더 정보·장비·컬렉션 요약 카드, 라이브러리별 파일/처리/없어짐, 캐시, 잡 큐) → `/admin/sources`(폴더 선택기로 등록, 지금 스캔, 삭제) → `/admin/film`(필름 롤 메타: 확정(저장한 것, 한 줄 표에서 수정)/미확정(폴더명에서 자동으로 읽음, 폼 전체) 탭, 현상월·카메라·렌즈·필름(고정렌즈 바디면 렌즈 자동), 저장 시 EXIF 없는 파일 날짜 적용) → `/admin/pairs`(원본↔보정 페어링: 검토 필요/자동 묶임/확정/원본 없음 탭, 카드 그리드 + 무한 스크롤, 묶인 카드에 올리면 원본 말풍선·누르면 비교 창에서 확정/풀기, 파일명으로 수동 연결, 일괄 확정·확정 전부 취소는 확인 팝업) → `/admin/gear`(장비 등록: 카메라·렌즈·필름, 고정렌즈, 포맷(디지털 센서/필름 규격 프리셋), 수정, ≡ 끌어서 순서 바꾸기 — 폴더명 자동 인식과 드롭다운의 재료) → `/admin/visibility`(직접 바꾼 공개 설정 모아보기) → `/admin/sources/{id}`(등록한 폴더 수정·일괄 공개/숨김·삭제).
- 필름 장비: 롤 폴더명 `YYMM_RR …` 에서 현상월·롤 번호를 읽고, 나머지 글자에서 **등록된 장비**(띄어쓰기·대소문자 무시, 브랜드를 뺀 나머지나 긴 고유 단어 하나로도)를 찾아 카메라·렌즈·필름을 채운다(구분자 불필요; 없으면 `-` 규칙으로 폴백). 고정렌즈 바디는 렌즈가 자동으로 붙는다. 사진마다 다른 장비는 사진 페이지 정보 드로어에서 덮어쓴다(수동 표시). 표시 우선순위: 수동 > (필름: 롤 > EXIF / 디지털: EXIF > 롤).
- 페어링: 보정 파일이 처리되면 원본 후보를 찾아 점수를 매긴다 — 파일명 stem +0.5, EXIF 촬영시각 ±1초 +0.4, 카메라 +0.1, pHash 거리 ≤4 +0.5(≤10 +0.3). 0.8 이상은 자동으로 원본의 사진에 붙고(미확정 표시), 0.5~0.8 은 `/admin/pairs` 검토 큐, 그 미만은 단독 사진으로 남는다. 묶이면 사진의 tier 는 보정본 중 최고(A>B), 날짜는 원본을 따른다.
- 워커: Source 마다 `poll_interval_min`(기본 30분)으로 주기 스캔. 신규/변경 파일 → SHA-256 → ExifTool → (RAW 면 내장 프리뷰) → sharp 로 thumb 480 / preview 1600 webp(sRGB) + thumbhash + pHash → Photo 연결. full 2560 은 열 때 생성. 같은 폴더·같은 stem 의 RAW+JPG 는 한 Photo(RAW 우선 표시).
- 컬렉션: `/collections` 는 제목·연도·장수의 글자 리스트(호버 시 커버 미리보기), `/c/{slug}` 는 서문 + 편집 흐름(한 장 크게/두 장/세 장 리듬, 세로 사진은 둘씩). 관리자 `/admin/collections` 에서 수동(사진 페이지의 '컬렉션에 추가', 순서·커버·빼기) 또는 스마트(매체·컷·라이브러리·연도 규칙, 필름은 롤마다 시리즈) 컬렉션을 만든다. 스마트 컬렉션은 스캔·페어링 뒤 자동으로 다시 계산된다.
- 공개 페이지: `/archive`(공개 사진, 월별, B컷 토글은 설정/관리자), `/library/{slug}`(Source 통째로, 그 폴더의 변형을 RAW 우선으로, 공개 설정된 것만 게스트에게), `/p/{id}`(사진 + 스펙 시트 드로어, ←/→/i/Esc, `\` 또는 버튼으로 원본⇄보정, 보정본이 여럿이면 칩, ↺↻ 회전 보기, 관리자는 방향 저장), `/`(공개 A컷 무작위 필름 스트립).
- `/media/{file_id}/{thumb|preview|full}.webp?v=` 는 공개 사진만(관리자는 전부), `/media/{file_id}/original` 은 관리자만.

## 공개 범위 모델

- **컷(A/B)은 분류 라벨**이다. 게스트에게 보이는지는 **사진마다의 공개 여부(public/hidden)** 로만 정해진다. 아카이브에서는 필터 바(매체 · 컷 A/B/원본만 · 카메라 · 렌즈 · 필름)로 골라 본다.
- 폴더(라이브러리)를 등록할 때 "게스트 공개"(공개/비공개)가 새로 찾는 사진의 **기본값**이 된다(권장: 원본 비공개, 보정 A컷 공개, B컷 비공개). `/admin/sources/{id}` 에서 바꾸면 기존 사진에도 바로 적용된다.
- 사진 페이지에서 개별로 '공개하기/숨기기'를 누르면 **수동 설정**으로 표시되어 폴더 일괄 적용에서 제외된다. `/admin/visibility` 에 수동으로 바꾼 사진이 모여 있고 '기본값으로' 되돌릴 수 있다.
- 폴더 페이지 `/library/{slug}` 는 관리자 전용 작업 화면이다(페어링 전 원본과 RAW 포함). 게스트에게는 아카이브 · 컬렉션 · 랜딩만 있다.
- 랜딩 필름 스트립은 공개 보정본 중 A컷만(기본) 또는 A+B를 보여준다 — `/admin/settings`. 보정본 없이 원본만 있는 사진은 랜딩에 나오지 않는다.
- 필터의 카메라 · 렌즈 · 필름은 `photo_meta` 뷰(마이그레이션 0006)가 계산한 유효 장비다: 사진별 수동 값 > (필름: 롤 정보 > EXIF / 디지털: EXIF > 롤 정보).

## 검색 (3단계)

- `/search` 는 말로 찾는다("비 오는 밤 골목"). 질의를 `ml` 컨테이너(Immich machine-learning, OpenVINO)로 벡터로 바꾸고 pgvector 코사인 거리로 가까운 사진 60장을 보여준다. 게스트는 공개 사진만. 1등이 라이브러리 평균 위로 올라간 폭의 55% 에 못 미치는 결과는 '관련도 낮음'으로 접고(모델마다 값의 범위가 달라 0 이 아니라 평균에서 잰다), 사진끼리 코사인이 설정 기준(기본 0.85) 이상인 비슷한 컷은 대표 한 장에 +숫자로 묶어(같은 무대·같은 배경 연사가 결과를 메우지 않게; 묶인 컷은 사진 페이지 '비슷한 사진'에서 보인다), 1등 유사도가 설정의 모델별 기준보다 낮으면 "맞는 사진이 없습니다"로 접는다(관리자에게만 보이는 결과 밑 '유사도 최고' 숫자를 보고 정한다 — 모델마다 값의 범위가 다르다). 라이브러리 평균 방향 성분을 빼서(주성분 하나 제거) 회색 벽·흐린 컷처럼 내용 없는 사진이 약한 질의마다 끼는 허브 효과를 줄인다. 모델이 모르는 낱말(예: 윤슬)은 장면으로 풀어 쓰는 편이 낫다.
- 사진마다 primary 파일(보정본 우선)의 preview 파생본을 워커가 임베딩해 `embeddings` 에 둔다(모델 이름·차원 포함, 인덱스 없이 정확 탐색 — 수천 장이면 충분). 파일이 처리되면 자동으로 큐에 들어가고, 사진 페이지 정보 드로어에 '비슷한 사진' 12장이 나온다. 워커는 임베딩 잡을 20개씩 묶어 가져오고 밀려 있으면 쉬지 않고 이어 간다(ML 호출 하나가 0.1초라 2초마다 하나씩 가져오면 GPU 가 논다). 실패는 잡 단위로 기록·재시도한다.
- 모델은 `/admin/settings` 에서 고른다 — `ViT-L-16-SigLIP2-256__webli`(기본, 다국어라 한글 질의가 바로 된다), `ViT-SO400M-16-SigLIP2-384__webli`, `nllb-clip-large-siglip__v1`. 사진 쪽이 SO400M 인 뒤의 둘은 Intel Arc A380 의 OpenVINO 에서 추론이 실패하므로(Immich 스마트 검색도 마찬가지) CPU 이미지의 ML 로만 쓴다. 바꾸면 전체를 다시 임베딩하고, '빠진 임베딩 채우기'로 누락분만 채운다. nllb 계열은 질의 언어 코드(`ko` 등, 글자로 알 수 있으면 자동)를 같이 보낸다.
- `ml` 컨테이너는 첫 요청 때 모델을 내려받는다(인터넷 필요, `ml-cache` 볼륨에 보관). 같은 볼륨을 app 에 `/mlcache` 로 마운트하고 `ML_CACHE_DIR=/mlcache` 를 주면(기본 compose 가 그렇게 한다) 설정 화면에서 받아 둔 모델의 용량을 보고 안 쓰는 것을 지울 수 있다. ml 도 app 과 같은 `PUID`/`PGID` 로 돈다(compose 의 `user:` + `group_add` — GPU 장치가 호스트 render 그룹 소유라 `RENDER_GID` 가 필요하다). 받은 모델이 PUID 소유라 설정에서 바로 지울 수 있고, 예전에 root 로 받아 둔 파일은 app 이 기동 때 소유권을 맞춘다. 모델은 마지막 요청 뒤 `ML_MODEL_TTL` 초(Immich 기본 300) 지나면 메모리·VRAM 에서 내려가고 다음 요청 때 다시 올라온다(몇 초). 0 이면 계속 올려 둔다. 모델 하나가 1~4GB 라 시험한 것들을 그냥 두면 디스크가 찬다. 첫 임베딩은 모델 로딩 때문에 몇 분 걸릴 수 있다. ML 이 꺼져 있으면 검색 페이지에 안내만 뜨고, 임베딩 잡은 몇 번 더 시도한다.
- **Immich 의 ML 같이 쓰기**: 같은 호스트에 Immich 가 있으면 그 machine-learning 컨테이너를 그대로 쓸 수 있다(API 가 같다). 같은 모델이면 메모리·VRAM 에 한 벌만 올라가고, Immich 에서 GPU 로 도는 게 확인된 설정을 그대로 탄다. Portainer 스택에서 (1) `ml` 서비스와 app 의 `ml-cache:/mlcache` 줄을 지우고, (2) app·worker 에 Immich 컨테이너가 있는 네트워크를 붙이고(`docker inspect immich-machine-learning --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}'` 로 이름 확인), (3) `ML_URL=http://immich-machine-learning:3003`. 이때 설정의 '받아 둔 모델' 표는 비고, 모델 캐시는 Immich 쪽에서 관리한다. Immich ML 이 내려가 있으면 검색도 멈추고 임베딩 잡은 재시도한다.
- 로컬 개발에는 `node --import tsx scripts/fake-ml.ts` 가 /ping, /predict 를 흉내 낸다(결과는 무의미, 파이프라인 검증용). `.env` 의 `ML_URL=http://127.0.0.1:3003`.

## 보안과 권한

- **첫 관리자 생성**(`/admin/setup`)은 관리자가 0명일 때만 열리고, 앱이 기동하며 로그에 찍는 **설정 토큰**을 요구한다. `docker compose logs app | grep setup` 으로 확인한다. 계정을 만들면 토큰은 사라지고 페이지는 로그인으로만 간다.
- **로그인**은 IP 당 10분에 실패 10회까지. 프록시 뒤에서 IP 를 제대로 보려면 compose 의 `ADDRESS_HEADER=X-Forwarded-For` 를 켠다(기본 켜져 있음). 세션은 HttpOnly·SameSite=Lax 쿠키이고 https 로 접속하면 Secure 가 붙는다. **`ORIGIN` 과 같은 주소로 접속해야 로그인이 유지된다**(https 로 설정해 두고 http://IP:3000 으로 들어가면 쿠키가 거부된다).
- 폼 요청은 SvelteKit 이 `ORIGIN` 과 비교해 CSRF 를 막는다.
- 원본 폴더는 컨테이너에 **read-only** 로 마운트되고, 앱은 사이드카도 쓰지 않는다. 폴더 선택기와 모든 경로 API 는 `/photos` 아래로만 제한된다(상위 탈출 불가).
- 게스트는 공개(`visibility=public`) 사진의 파생본만 받는다. 숨긴 사진은 썸네일도 404. 원본 파일(`/media/{id}/original`)은 관리자 세션에서만.
- 컨테이너는 `PUID`/`PGID`(기본 1000:1000)로 돈다. entrypoint 가 root 로 시작해 `/cache` 소유권을 그 uid 로 맞춘 뒤 권한을 내린다. 사진 파일은 그 uid 가 읽을 수 있어야 한다 — 소유자가 1000 이면 그대로 맞고, 다른 사용자면 `.env` 의 PUID/PGID 를 그 값으로. 캐시 파일도 그 사용자 소유로 생긴다. root 로 돌리려면 `PUID=0`.
- 사진 폴더 위치: 컨테이너 안에서는 항상 `/photos` 다. 실제 위치는 `PHOTOS_HOST_PATH` 로 준다(예: `/mnt/pool/photos`). 폴더 선택기의 `/photos/...` 는 그 아래를 가리킨다.

## 디스크 사용량

서버 SSD 에 쌓이는 것은 세 가지다.

- **캐시(`CACHE_HOST_PATH`)**: 사진마다 WebP 파생본. 스캔 때 미리 만드는 건 thumb(480px, 30~60KB)와 preview(1600px, 150~350KB)뿐이고, full(2560px, 400~900KB)은 **누가 그 사진을 열 때** 만들어 쌓인다. 실제 사진 기준 대략 **1,000장에 0.3~0.4GB**(미리 만드는 것) + 열어본 사진당 0.5~0.9MB. 관리자 대시보드에 현재 사용량이 보인다.
  - 전부 미리 만들고 싶으면 worker 에 `EAGER_FULL=1`.
  - SSD 가 빠듯하면 `CACHE_HOST_PATH` 를 HDD 풀로 둬도 된다. 썸네일을 읽을 때 디스크가 깨는 대신 용량 걱정이 없다.
  - 캐시는 전부 재생성 가능하다. 지워도 다음 스캔(`지금 스캔`)과 열람 때 다시 만들어진다.
- **DB 볼륨(`db-data`)**: 파일당 ExifTool 메타 JSON 10~30KB + 임베딩 3KB. 1만 장에 0.3~0.5GB.
- **ML 모델(`ml-cache`)**: Immich ML 이 받는 CLIP 모델 1~3GB(3단계부터 의미 있음). 지금 당장 필요 없으면 compose 에서 `ml` 서비스를 빼도 된다.
- 이미지 자체: app 약 0.6GB, immich-machine-learning(openvino) 약 2~3GB, pgvector 약 0.4GB.

## 구조

```
src/routes/            페이지와 API (+page.svelte, +server.ts)
src/lib/components/    Header, FilmStrip, …
src/lib/server/        env/config, db(schema, migrate), auth, sources, gallery 쿼리, fs(폴더 선택기)
src/worker/            pg-boss 워커: scan(폴더 걷기), process(해시·EXIF·파생본·Photo), image(sharp)
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
