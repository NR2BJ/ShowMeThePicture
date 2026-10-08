# ShowMeThePicture — 설계 문서 v0.4

작성 2026-10-08 · v0.3 → v0.4: 설정의 경계(§8.1) — compose 는 인프라만, 앱 설정과 Source 등록은 관리자 페이지(폴더 선택기). GitHub(NR2BJ/ShowMeThePicture) + GHCR 이미지 + Portainer 배포 흐름. v0.2 → v0.3: §10 결정 완료(SvelteKit 확정, /dev/dri 확인, 필름 이름 규칙, 원본 공개 정책, 랜딩 A컷). 라이브러리 페이지(§2.4) 추가, 원본 표시는 RAW 우선으로 변경, 랜딩 클릭 동작 명시. v0.1 → v0.2: 서버·폴더 구조 반영, 사진 단위 정정, 스택 제안, 랜딩 구체화.

---

## 0. 한 줄 정의, 목표, 비목표

**내 원본 스토리지를 그대로 읽어서, 보정본을 중심으로 보여주되 버튼 하나로 원본으로 전환할 수 있고, 한글로 시맨틱 검색이 되는 셀프 호스팅 사진 포트폴리오.**

v1 목표

- 스토리지 원본 경로를 그대로 등록한다(read-only). 복사·업로드 없음. **지금의 폴더 구조를 정리하지 않아도 된다.**
- 사진 한 장 = 원본(RAW+JPG) + 보정본 N개. 사진 페이지에서 버튼 하나(또는 `\` 키)로 원본⇄보정 전환, 보정본이 여럿이면 칩으로 선택.
- 디지털/필름, A컷/B컷을 폴더가 아니라 속성으로 다룬다. 파일 트리 UI는 없다.
- EXIF/XMP/IPTC/MakerNotes 전부 추출·표시. EXIF가 없는 필름 스캔은 롤(폴더) 단위 메타로 보완.
- 한글 시맨틱 검색 + 메타데이터 필터 + 유사 사진. Intel Arc A380에서 가속.
- 게스트는 로그인 없이 열람. 관리자 1명, 우상단 로그인.
- 등록한 원본 폴더는 하위 폴더 구분 없이 통째로 훑어보는 **라이브러리 페이지**가 있다. 보정 여부와 무관하게 전부 보이고, RAW를 우선 표시하고 RAW가 없으면 JPG.
- 랜딩은 날짜 그리드가 아니라 **보정본 중 무작위 사진이 필름 스트립으로 흘러가는 화면**. 그 안쪽은 차분한 작가 사이트.

v1 비목표

- 업로드, 다중 사용자, 공유 권한 체계, 얼굴 인식, 모바일 앱, 사진 편집, **원본 파일 수정(영원히 안 함)**.

---

## 1. 왜 직접 만드나

정정 두 가지는 v0.1과 같다: Immich는 다국어 CLIP 모델로 바꾸면 한글 검색이 되고, External Library로 원본 경로 인덱싱도 된다. Immich 검색이 "애매하게" 느껴진 건 기본 모델(`ViT-B-32__openai`, 영어 전용·소형) 탓이 크다. 더 큰 다국어 모델로 바꾸면 체감이 달라진다(§3.6에서 벤치 방법).

그래도 직접 만드는 이유: **로그인 없는 공개 포트폴리오, 원본⇄보정 토글, 작가 사이트 디자인**은 Immich·PhotoPrism·Photoview 어느 것도 안 된다. 비교표는 v0.1과 동일하므로 생략.

대신 Immich에서 **가져다 쓸 것**은 가져다 쓴다: 임베딩 엔진은 v1에서 Immich의 ML 컨테이너를 그대로 쓴다(§3.6). OpenVINO로 A380 가속이 이미 되어 있고, 모델 다운로드·토크나이저 문제가 해결돼 있다.

---

## 2. 핵심 개념 모델

**저장 구조(폴더)와 보여주는 구조(컬렉션)를 분리한다.** 폴더는 `Source`로 등록만 하고, 사이트에는 `Collection`만 보인다.

```
Source(등록한 폴더) ─scan─▶ File(파일 1개) ─pair─▶ Photo(논리적 사진 1장) ─curate─▶ Collection
```

### 2.1 Photo = 사진 한 장 (v0.1 정정)

```
Photo
 ├─ originals  RAW  SAM_1234.SRW          ← 카메라가 만든 것 (RAW/JPG 둘 다, 또는 하나만)
 │             JPG  SAM_1234.JPG
 └─ edits      기본        SAM_1234.jpg     ← 내가 만든 것. N개. 라벨은 파일명 접미사에서
               사이버펑크  SAM_1234_cyberpunk.jpg
               미니어처    SAM_1234_miniature.jpg
 tier     A | B | none    ← 사진 단위 플래그. 보정본이 A폴더에 있으면 A, B폴더면 B
 primary  기본 표시 variant ← 보통 edits의 '기본'. 보정본이 없으면 originals의 RAW(내장 프리뷰), RAW가 없으면 JPG
```

- **A컷/B컷은 같은 사진의 버전이 아니라 다른 사진이다.** A = 걸작이라고 판단한 것, B = 보정은 했지만 그 정도는 아닌 것. 그래서 tier는 variant가 아니라 **Photo의 플래그**다. (v0.1에서 "A컷·B컷이 같은 원본의 variant"라고 쓴 부분은 틀렸다.)
- 한 사진의 보정본이 A폴더와 B폴더 양쪽에 있으면 tier = A (높은 쪽). 파일을 B폴더에서 A폴더로 옮기면 다음 스캔 때 tier가 자동으로 바뀐다(콘텐츠 해시로 같은 파일임을 안다).
- 보정본의 라벨: `stem` 뒤 접미사(`_cyberpunk` → "cyberpunk"), 접미사가 없으면 "기본". 관리자가 이름을 바꿀 수 있다. primary edit = 접미사 없는 것, 없으면 가장 최근 export, 관리자 지정이 최우선.
- 보정본만 있고 원본을 못 찾은 사진도 Photo(토글 비활성). 원본만 있는 사진도 Photo(tier none, 기본 비공개).

### 2.2 지금 폴더 구조에 Source를 어떻게 붙이나

폴더가 "개판"이어도 된다. Source는 폴더 하나당 하나이고, 깊이는 상관없다.

| 실제 폴더 (`…/photo123/` 아래)                 | role     | medium  | tier  | 비고                                              |
| ---------------------------------------------- | -------- | ------- | ----- | ------------------------------------------------- |
| `nx500/20xx-xx-xx/`                            | original | digital | –     | 날짜 폴더 안에 JPG+SRW. 날짜 폴더명은 촬영일 폴백 |
| `f31fd/`                                       | original | digital | –     | JPG만                                             |
| `film/25.09_01 Rollei35s kodak colorplus 200/` | original | film    | –     | 롤 폴더명 파싱 → 시리즈 + 롤 메타                 |
| `여자의변신은무죄/`                            | edit     | –       | **A** | 평탄한 목록                                       |
| `(B컷 폴더)/`                                  | edit     | –       | **B** | 평탄한 목록                                       |

- 나중에 폴더를 옮기면 Source 경로만 바꾸면 된다. 파일 식별은 콘텐츠 해시라 사진 id·페어링·컬렉션이 유지된다.
- 보정 폴더가 평탄하므로 디지털 쪽 컬렉션은 **수동** 또는 **연도/카메라 규칙**으로 만든다. 필름은 롤 폴더가 그대로 시리즈가 된다.

### 2.3 Collection

- 수동: 관리자가 사진을 고르고 순서를 정한다.
- 스마트(규칙): `medium=film` → 롤별 시리즈, `year=2025`, `camera=NX500` 같은 조건. 폴더 이름을 제목으로 승격시킬 수도 있다.
- 깊이는 컬렉션 › 시리즈 2단계까지. 더 깊은 건 평탄화.
- 시작 제안: "Film"(롤 시리즈 자동), "Selected"(수동), 그리고 `/archive`(전체, 날짜순)면 충분하다.

### 2.4 Library (Source를 통째로 보기)

- Source마다 `/library/{slug}` 페이지가 있다. 그 폴더 아래 **모든 사진을 하위 폴더 구분 없이 평탄하게**, 날짜순으로 보여준다. 트리 없음.
- 표시 variant: RAW 우선(ExifTool 내장 프리뷰 → 없으면 libraw 렌더), RAW가 없으면 JPG. RAW+JPG는 한 장으로 묶인다.
- 권한: 관리자는 모든 라이브러리의 모든 사진을 본다. 게스트는 Source의 `library_public`이 켜진 라이브러리만, 그 안에서도 `visibility=public`인 사진만 본다.
- 즉 "보정 없는 원본은 기본 비공개"는 **공개 사이트(아카이브·컬렉션·검색·랜딩)** 기준이고, 관리자인 나는 라이브러리에서 언제든 전부 볼 수 있다. 특정 원본 폴더를 남에게도 열고 싶으면 그 Source의 `default_visibility=public` + `library_public=true`로 바꾸고 일괄 적용하면 된다.

---

## 3. 기능 설계

### 3.1 라이브러리 등록과 스캔

- 컨테이너에는 넓은 루트 하나만 `:/photos:ro` 로 마운트한다(풀 전체나 `photo123` 의 부모). **Source 등록은 관리자 페이지의 폴더 선택기**로 `/photos` 아래 디렉터리를 골라서 한다. 경로 문자열을 직접 입력하는 API 는 없고, 서버는 `/photos` 밖을 절대 열거하지 않는다. 폴더를 더 등록할 때 compose 를 건드리지 않는다. 앱은 원본에 절대 쓰지 않는다(사이드카도 없다). 파생본은 **VM의 SSD 볼륨**에 둔다. HDD 풀은 스캔·파생본 생성 때만 읽고, 열람은 SSD 캐시만 쓴다. 디스크가 자고 있어도 사이트는 빠르다.
- **mergerfs(FUSE)는 inotify를 지원하지 않는다.** 그래서 실시간 감지는 없고 **주기 스캔**(기본 30분, Source별 조정) + 관리자 "지금 스캔" 버튼이다. 스캔은 `(상대경로, size, mtime)` 비교라 12개 HDD를 다 깨우지 않고 디렉터리 메타만 읽는다. 신규·변경 파일만 BLAKE3 해시.
- 사라진 파일은 `missing`으로 표시만 한다(풀 마운트가 잠깐 빠져도 DB가 안 날아간다).
- 한글 폴더명(`여자의변신은무죄`): NFC 정규화 값을 따로 저장해 매칭·표시에 쓰고, 접근은 원래 바이트로.
- 포맷: JPEG, PNG, TIFF(16bit), WebP, RAW(SRW/NEF/ARW/CR2/CR3/RAF/DNG). HEIC는 v1 제외(§4 참고).

### 3.2 메타데이터

- ExifTool(`exiftool-vendored`, stay_open 배치). EXIF/XMP/IPTC/MakerNotes/ICC를 JSON으로 통째로 저장 + 자주 쓰는 필드 정규화. SRW(삼성 RAW)는 ExifTool이 내장 프리뷰까지 지원한다.
- 촬영시각: EXIF `DateTimeOriginal` → XMP → 폴더명(`20xx-xx-xx`) → 롤 메타(현상월) → mtime → 수동. 출처를 기록.
- **롤 폴더·파일 이름 규칙(확정)**. 폴더가 아직 적어서 규칙을 새로 정한다:
  - 폴더: `YYMM_RR 카메라 - 필름` → 예 `2509_01 Rollei 35S - Kodak ColorPlus 200`. 파서 `^(\d{4})_(\d{2})\s+(.+?)\s+-\s+(.+)$` → 현상월, 롤 번호, 카메라, 필름. 기존 `25.09_01 …` 형식도 읽히게 `.`은 선택으로 둔다. `-`가 없으면 나머지를 통째로 라벨로 저장.
  - 파일: `YYMM_RR_NNN.ext` → 예 `2509_01_007.tif`. stem이 전역 유일해져 보정본과의 페어링이 파일명만으로 확정된다. 리네임은 앱이 아니라 외부 batch rename 도구로(앱은 원본에 쓰지 않는다). 관리자 페이지에 "규칙에 안 맞는 폴더/파일" 목록을 보여줘 정리 대상을 알려준다.
  - 파싱 결과는 "롤 정보" 폼에 미리 채워지고, 포맷(35mm·120)·스캐너·메모는 거기서 입력(이전 입력값 자동완성). 롤 메타는 그 폴더 사진 전체에 상속되고, 파일 EXIF가 있으면 파일이 우선.
- 사진 페이지 "스펙 시트": 카메라 / 노출 / 렌즈 / 필름 / 파일 / 위치 / 보정 정보. 전체 덤프는 접기 안에.
- GPS는 게스트에게 기본 숨김.

### 3.3 원본 ↔ 보정 페어링

실제 stem: NX500 `SAM_1234`(JPG+SRW 동일 stem), F31fd `DSCF1234`, 필름 스캔은 스캐너마다 다름.

1. 보정 파일의 stem에서 접미사를 떼어 `stem_norm`을 만든다(`SAM_1234_cyberpunk` → `SAM_1234`, 라벨 "cyberpunk"). Lightroom 계열 접미사(`-Edit`, `-2`, ` copy`)도 제거.
2. `stem_norm`이 같은 원본 후보를 모은다. **후보가 하나면 끝.** (대부분의 디지털 사진이 여기서 끝난다.)
3. 후보가 여럿이면(카메라 카운터 순환, 롤마다 반복되는 스캔 파일명) **pHash 해밍거리**로 가른다. 촬영시각이 있으면 그것도 본다.
4. 후보가 없으면 촬영시각 ±2초 → pHash 전수 비교(64bit, 수만 장도 ms) → 그래도 없으면 단독 Photo.
5. 점수 0.8 이상 자동, 0.5~0.8 검토 큐, 미만 미페어링. 관리자 수동 페어/해제가 최종.
6. 원본 폴더의 JPG+SRW는 stem 일치 + 촬영시각 일치면 한 Photo의 originals. "원본 보기"와 라이브러리 표시는 **RAW 우선**(ExifTool 내장 프리뷰), RAW가 없으면 JPG.

필름: §3.2의 파일 규칙 `YYMM_RR_NNN`을 따르면 stem이 전역 유일해서 파일명만으로 페어링이 확정된다. 아직 리네임 전인 폴더(`001.jpg` 반복)는 pHash가 가른다.

### 3.4 사진 페이지의 전환 UX

- 기본 = primary(보정). 버튼 하나 `원본 ⇄ 보정`. 단축키 `\` (Lightroom Before/After).
- 보정본이 여럿이면 버튼 옆에 칩 `기본 · 사이버펑크 · 미니어처`, 숫자키 1~9. `\`는 "원본 ⇄ 지금 선택된 보정본".
- 같은 박스 안에서 150ms 크로스페이드, `object-fit: contain`, 바탕은 검정. 크롭이 달라도 정렬 보정은 안 한다.
- 전환 시 한 줄 diff: `원본 SRW 5472×3648 → 보정 JPG 3000×2000 (크롭됨)`.
- v2: 드래그 분할 비교 슬라이더.

### 3.5 컬렉션 · 아카이브 · 정렬

- `/archive`: 공개 사진 전체, `taken_at` 내림차순, 연/월 헤더, 필터(디지털/필름, 연도, 카메라, tier). 랜딩이 아니라 메뉴에서 들어간다.
- 컬렉션 정렬은 컬렉션마다(촬영순/수동). 보정본의 `taken_at`은 원본 것을 따른다.
- 게스트 기본은 A컷만. "B컷 포함" 토글(또는 B는 관리자만 — 설정).

### 3.6 검색

**v1 엔진: Immich의 ML 컨테이너를 그대로 쓴다.** `ghcr.io/immich-app/immich-machine-learning:<버전>-openvino`를 `ml` 서비스로 띄우고 `/dev/dri`를 넘기면 A380에서 돈다. 우리 쪽은 얇은 어댑터 모듈 하나(`POST /predict` 호출)만 쓴다. 버전은 고정(pin). 장점: ML 코드 0줄, OpenVINO·모델 다운로드·토크나이저가 다 해결돼 있음, 모델 선택지가 Immich와 동일.

**지금 당장 할 수 있는 벤치(코드 없이)**: 돌아가고 있는 Immich에서 관리자 설정 → Machine Learning → Smart Search 모델명을 바꾸고 Smart Search 잡을 다시 돌린 뒤, 한글 질의 20개("비 오는 밤 골목", "역광 인물", "눈 쌓인 산" …)로 비교한다. 후보:

1. `nllb-clip-large-siglip__v1` — NLLB 텍스트 인코더, 한국어 확실. 6GB VRAM이면 large도 된다.
2. SigLIP 2 계열(`ViT-SO400M-16-SigLIP2-384__webli` 등, Immich 버전에 따라 목록 확인) — 다국어 학습, 최신.
3. `ViT-B-16-SigLIP-i18n-256__webli` — 가벼운 다국어.
   거기서 제일 마음에 드는 모델명을 우리 설정값으로 그대로 가져온다.

- 임베딩 저장: Postgres pgvector, HNSW cosine. 모델을 바꾸면 재임베딩 잡.
- 유사 사진: 이미지→이미지 같은 벡터.
- 메타 필터는 SQL. 캡션/키워드/파일명 한글 부분검색은 `pg_trgm`.
- **"문맥 검색"이 여전히 약하면 v2**: 우리 자체 Python ML 서비스(onnxruntime-openvino)를 추가해서 (a) Immich 목록 밖 모델(Jina CLIP v2 등), (b) 소형 VLM(2~3B, int8)으로 사진마다 **한글 캡션·태그를 생성**해 저장 → 벡터 + 텍스트 하이브리드 검색. A380 6GB에서 배치로 돌릴 수 있는 크기다. (c) 사진 속 글자 검색이 필요하면 PaddleOCR(한국어). 전부 선택 사항.

### 3.7 권한

- 게스트: 읽기 전용, `visibility=public`만, **원본 파일은 절대 못 받는다**("전체 보기"도 `guest_max_edge` 2560px 파생본).
- 관리자: 단일 계정, argon2 + HttpOnly·SameSite=Strict 세션 쿠키. TOTP는 v2.
- 관리자 기능: Source 등록/재스캔, 잡 현황, 페어링 검토·수동 페어, primary/라벨 지정, 공개·숨김·tier·제목·캡션·촬영일 수정(일괄 포함), 컬렉션 편집, 롤 정보 입력, 사이트 설정(제목·About·랜딩 모드·게스트 최대 해상도·GPS·B컷 정책), 원본 다운로드, 모델 교체·재임베딩.
- Source별 `default_visibility`: 보정 A 폴더 public, B 폴더 설정값, 원본 폴더 hidden.

---

## 4. 아키텍처와 스택 (v0.2에서 확정 제안)

### 4.1 결정: TypeScript 풀스택 (SvelteKit, Svelte 5). Python은 ML 컨테이너 안에만.

판단 기준은 당신이 말한 그대로다: 혼자 쓰고 남이 보는 개인 포폴, 양은 모르지만 늘 수 있음, 예쁜 프론트, 전통 강자보다 최신 기술.

| 계층           | 선택                                                 | 이유                                                                                                                                                                         |
| -------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 앱(페이지+API) | **SvelteKit + Svelte 5**, TypeScript, `adapter-node` | 전환 애니메이션·트랜지션이 언어에 내장(필름 스트립, 크로스페이드에 딱). SSR이라 카톡·트위터 링크 미리보기(OG)가 공짜. 번들 작음. 지금 가장 "신흥 최신"이면서 안정화된 프론트 |
| 스타일         | Tailwind v4 + 시그니처 컴포넌트는 손 CSS             | 토큰은 `@theme`로, 필름 스트립·라이트박스는 직접                                                                                                                             |
| DB             | PostgreSQL 17 + pgvector, **Drizzle ORM**            | TS 타입이 스키마에서 나옴, pgvector 컬럼 지원                                                                                                                                |
| 잡 큐          | **pg-boss**                                          | Postgres만으로 큐. Redis 없음                                                                                                                                                |
| 워커           | 같은 코드베이스, 별도 프로세스                       | 스캔·ExifTool·파생본·해시·페어링                                                                                                                                             |
| 이미지         | **sharp**(libvips)                                   | 16bit TIFF, ICC→sRGB, 빠름. Immich도 같은 라이브러리                                                                                                                         |
| 메타           | **exiftool-vendored**                                | ExifTool 바이너리 동봉, stay_open, RAW 내장 프리뷰 추출                                                                                                                      |
| 해시           | hash-wasm(BLAKE3), pHash 직접(32×32 DCT), thumbhash  |                                                                                                                                                                              |
| ML             | immich-machine-learning(openvino)                    | §3.6. v2에 자체 Python 서비스 추가 가능                                                                                                                                      |
| 프록시         | 외부 reverse proxy (LXC Caddy)                       | 이미 있는 것을 쓴다. 스택 안에는 두지 않는다                                                                                                                                 |
| 런타임         | Node 22 LTS, pnpm                                    | Bun은 sharp/exiftool 호환이 아직 확인 대상이라 나중에                                                                                                                        |

솔직한 단점

- Svelte 5의 runes 문법이 새 편이라 AI 코딩 도구가 가끔 Svelte 4 식으로 쓴다. 잡아내면 된다.
- sharp의 기본 바이너리에 HEIC가 없다(특허). NX500·F31fd·필름엔 무관. 아이폰 HEIC가 섞이면 libvips 커스텀 빌드나 Python 폴백 추가.
- 생태계는 React보다 작다. 하지만 토글·필름 스트립·라이트박스는 어차피 직접 만든다.

v0.1의 FastAPI + 별도 프론트 안을 버린 이유: 언어 둘, 툴체인 둘, API 계약 유지 비용. ML을 컨테이너로 떼어내고 나니 Python이 꼭 필요한 곳이 앱에 없다.

### 4.2 배치

```
  게스트 / 관리자
        │ https://photos.example.com
   ┌────▼───────────────┐
   │ 외부 reverse proxy  │  Proxmox LXC 의 Caddy (TLS·도메인). 이 스택 밖.
   └────┬───────────────┘
        │ http://<VM IP>:3000
   ┌────▼──────┐     ┌─────────────┐     ┌───────────┐      ┌──────────────────────┐
   │ app       │────▶│ Postgres 17 │◀────│ worker    │─────▶│ ml                   │
   │ SvelteKit │     │ + pgvector  │     │ 스캔·메타  │ 임베딩│ immich-ml (openvino) │
   │ SSR + API │     │ + pg-boss   │     │ 파생·페어  │      │ /dev/dri → Arc A380  │
   │ + /media  │     └─────────────┘     └─────┬─────┘      └──────────────────────┘
   └────┬──────┘                               │
        │ 읽기(공개 여부 확인 후)                  │ 쓰기            원본 읽기 :ro
   ┌────▼───────────────────────────────────────▼───┐      ┌──────────────────────────┐
   │ cache 볼륨 (SSD) — thumb / preview / full webp  │      │ /mnt (mergerfs, HDD ×12)  │
   └────────────────────────────────────────────────┘      │  …/photo123  ← worker 만  │
                                                           └──────────────────────────┘
```

컨테이너 4개: `app`, `worker`, `ml`, `db`. TLS·도메인은 스택 밖의 reverse proxy(LXC 의 Caddy)가 맡고 `app:3000` 으로 프록시한다. 외부 프록시가 없으면 `compose.caddy.yaml` override. 이미지는 GitHub Actions 가 `ghcr.io/nr2bj/showmethepicture` 로 올린 것을 쓴다(§8.1).
compose 핵심:

- `app`/`worker`: `volumes: [ "${PHOTOS_HOST_PATH}:/photos:ro", "${CACHE_HOST_PATH}:/cache" ]` — 캐시는 VM의 SSD 경로.
- `app`: `ports: ["${APP_PORT:-3000}:3000"]`, `ORIGIN` 은 공개 URL.
- `ml`: `devices: ["/dev/dri:/dev/dri"]`만 있으면 된다(컨테이너가 root로 돌아 `group_add` 불필요). VM에서 `card0`, `card1`, `renderD128` 확인됨. 모델 캐시 볼륨.
- `app`은 텍스트 임베딩(검색 질의)만 `ml`에 직접 요청, 이미지 임베딩은 `worker`가.

규모: 수만 장은 여유, 10만 장 이상도 HNSW + keyset 페이지네이션 + 가상 스크롤이면 된다. 파생본을 SSD에 미리 만들어 두는 게 핵심이고, HDD는 잠들어 있어도 된다.

---

## 5. 데이터 모델

```
sources            id, slug, name, root_path, role(original|edit), medium(film|digital|null), tier(A|B|null),
                   default_visibility, library_public, poll_interval_min, last_scanned_at
files              id, source_id, rel_path, rel_path_nfc, filename, stem, stem_norm, edit_label,
                   ext, kind(raw|jpeg|tiff|png|webp), size, mtime, content_hash, status(active|missing),
                   width, height, orientation, color_profile,
                   taken_at, taken_at_source, camera_make, camera_model, lens, focal_length_mm,
                   f_number, exposure_time, iso, gps_lat, gps_lon, rating, keywords[], title, caption,
                   metadata jsonb, phash bytea, thumbhash bytea,
                   photo_id → photos, variant_role(original|edit), variant_label(RAW|JPG|기본|cyberpunk…),
                   derivatives_ready, indexed_at
embeddings         file_id PK, model text, embedding vector(D)
photos             id(ULID), primary_file_id, original_file_id, taken_at, title, caption,
                   visibility(public|hidden), tier(A|B|none), medium,
                   pair_method, pair_confidence, pair_confirmed, created_at
folder_meta        source_id, rel_dir, title, developed_at, roll_no, camera, lens, film_stock,
                   film_format, scanner, notes                      -- 롤/세션 메타, 하위 상속
collections        id, slug, title, statement_md, cover_photo_id, visibility,
                   kind(manual|smart), rule jsonb, sort(taken_asc|taken_desc|manual), position
series             id, collection_id, title, rel_dir, position
collection_photos  collection_id, photo_id, series_id?, position
admin_users        id, username, password_hash
settings           key, value jsonb        -- landing_mode, guest_max_edge, show_gps, b_cut_policy …
pgboss.*           pg-boss가 생성
```

인덱스: `files(source_id, rel_path)` unique · `files(content_hash)` · `files(stem_norm)` · `files(taken_at)` · `photos(taken_at desc) where visibility='public'` · `embeddings` HNSW(cosine) · trgm(filename, caption).

---

## 6. API 스케치 (SvelteKit `+server.ts`)

공개

```
GET  /api/site                                   제목, 테마, about, landing_mode
GET  /api/photos?sort=&cursor=&medium=&tier=&year=&camera=&collection=
GET  /api/photos/random?n=42&tier=A              랜딩용 무작위 샘플
GET  /api/photos/{id}                            photo + variants[] + 이웃(prev/next)
GET  /api/photos/{id}/similar
GET  /api/collections · /api/collections/{slug}
GET  /api/library/{slug}?cursor=                 Source 통째로(평탄), RAW 우선 표시
GET  /api/search?q=&medium=&year=&limit=
GET  /media/{file_id}/{thumb|preview|full}.webp  불변 URL(해시 포함), 1년 캐시. app 이 공개 여부 확인 후 스트리밍
/p/{id}, /c/{slug}                               SSR 페이지(OG 메타 포함)
```

관리자(세션)

```
POST  /api/auth/login · /logout
CRUD  /api/admin/sources · POST /api/admin/sources/{id}/scan · GET /api/admin/jobs
GET   /api/admin/pairs/review · POST /api/admin/pairs
PATCH /api/admin/photos/{id} · POST /api/admin/photos/bulk
CRUD  /api/admin/collections · PUT /api/admin/collections/{id}/order
PUT   /api/admin/folder-meta · PATCH /api/admin/settings · POST /api/admin/reindex
GET   /media/{file_id}/original                  관리자만
```

클라이언트가 경로를 보내는 API는 없다(전부 id). 검색은 레이트리밋.

---

## 7. 디자인

### 7.1 랜딩: 필름 스트립 (당신 아이디어를 구체화)

목업: `docs/mockups/landing-filmstrip.html` (이미지는 picsum 플레이스홀더).

- 검정 바탕. 35mm 필름 스트립 2~3줄이 가로로 흐른다. 줄마다 방향이 반대(지그재그), 속도가 조금씩 다르고, ±1° 정도 기울여 한 줄의 필름이 S자로 접힌 느낌.
- 프레임은 3:2 고정. 사진은 `contain`으로 넣고 남는 여백은 검정 — 크롭된 사진은 "필름 프레임 안의 프린트"처럼 보인다.
- 스프로켓 구멍 위아래. 프레임 바깥 여백(rebate)에 **실제 데이터**를 필름 가장자리 각인처럼 찍는다: 필름이면 `KODAK COLORPLUS 200`, 디지털이면 `SAMSUNG NX500`, 그리고 프레임 번호. 장식이 아니라 메타데이터다.
- 재료: **공개 A컷 보정본만**, 무작위 42장, 방문할 때마다 다시 섞음(`/api/photos/random?tier=A`).
- 마우스를 올리면 그 줄이 멈춘다. 프레임을 클릭하면 **사진 페이지가 랜딩 위에 오버레이로 열린다**(사진 크게 + 아래 한 줄 메타 + `원본 ⇄ 보정` + 스펙 시트 드로어). URL은 `/p/{id}`로 바뀌어 그대로 공유할 수 있고, 닫으면 랜딩으로 돌아온다. `prefers-reduced-motion`이면 정지. 모바일은 2줄, 더 느리게.
- 상단은 글자만: 좌상단 세리프 사이트명, 우상단 `컬렉션 · 아카이브 · 검색 · 소개` + 저대비 열쇠 아이콘(관리자).
- `landing_mode` 설정으로 교체 가능: `filmstrip`(기본) · `drift`(니코니코 식으로 사진이 제각각 높이·속도로 떠다님) · `slideshow` · `timeline`. 같은 데이터, 다른 컴포넌트.

중요한 균형: 랜딩이 유일하게 "연출"하는 화면이다. 안쪽 페이지는 조용해야 랜딩이 산다.

### 7.2 안쪽 페이지: 암실 톤의 작가 사이트

- 바탕은 순흑이 아닌 `#0b0b0a` 근처의 따뜻한 검정, 글자는 `#e8e4dc`. 라이트(종이) 테마는 v2 옵션.
- 서체: 제목 세리프 — Latin `Instrument Serif`, 한글 `마루 부리`(네이버 무료) 폴백. UI `Pretendard`. 메타데이터는 모노(`JetBrains Mono`, tabular numbers) — 필름 각인·랩 데이터 느낌을 랜딩과 공유.
- 여백이 UI다. 아이콘 거의 없음. 좋아요·소셜·배지·그림자 카드 없음.
- 컬렉션 목록: 큰 글자 리스트(제목 · 연도 · 장수), 호버 시 미리보기 한 장.
- 컬렉션 페이지: 서문 한 단락 → 종횡비에 따라 한 장 크게 / 두 장 나란히 / 치우침을 번갈아 배치하는 편집 흐름. 아카이브는 반대로 균일한 저스티파이드 그리드 + 연/월 헤더.
- 사진 페이지: 사진 중앙 85vh, 아래 한 줄 `2025.09 · Rollei 35S · Kodak ColorPlus 200` + `원본 ⇄ 보정` 필 + 보정 칩. "정보" → 오른쪽 드로어 스펙 시트. ←/→/`\`/Esc.
- 검색: 화면 중앙 큰 입력창, 한글 예시 칩.
- 모션: thumbhash → 페이드인, 토글 크로스페이드 150ms. 바운스·패럴랙스 없음.

---

## 8. 파이프라인 · 운영

### 8.1 설정의 경계와 배포 흐름

- **compose + 환경변수 = 인프라만**: `PHOTOS_HOST_PATH`, `CACHE_HOST_PATH`, `POSTGRES_*`, `ORIGIN`, `APP_PORT`, `APP_TAG`, `IMMICH_ML_VERSION`. 이게 전부다.
- **관리자 페이지 = 앱 설정 전부**: Source 등록(폴더 선택기), 사이트 제목·About, 랜딩 모드, 게스트 최대 해상도, GPS·B컷 정책, 검색 모델, 스캔 주기. `settings` 테이블과 `sources` 테이블에 저장되어 `db-data` 볼륨에 남는다. 재배포·이미지 업데이트에 영향받지 않는다. 세션 서명 키도 첫 기동 때 생성해 DB 에 둔다(환경변수 불필요).
- 배포: `main` push → GitHub Actions → `ghcr.io/nr2bj/showmethepicture:latest`(+ `sha-…`, `v*`). Portainer 에서는 **웹 에디터 스택**에 `compose.yaml` 을 붙여넣고 값만 바꾼다 — 레포의 compose 는 템플릿이지 고정이 아니며, 이후 수정은 Portainer 에서 한다. 새 이미지는 스택의 "Pull and redeploy" 로 받는다. 자동화를 원하면 Repository 스택(GitOps) + 레포 Secrets `PORTAINER_WEBHOOK` 조합이 선택지.
- `compose.yaml` 에는 `build:` 를 두지 않는다(웹 에디터 스택은 빌드 컨텍스트가 없어 실패). 소스 빌드는 `compose.build.yaml` override: `docker compose -f compose.yaml -f compose.build.yaml up --build`.

잡 체인(파일 1개): `scan → extract_metadata → derive → hash → embed → pair → rules`

- 파생본: thumb 480 / preview 1600 / full 2560(긴 변), WebP, sRGB 변환(AdobeRGB·ProPhoto 원본 대비). 경로 `cache/{id[:2]}/{id}/{size}.webp`, SSD.
- `/media/*` 는 app 이 서빙한다: 공개 사진(또는 관리자 세션)만 통과, `Cache-Control: immutable`, SSD 캐시에서 스트리밍. 외부 프록시는 TLS·도메인만 맡는다.
- RAW 원본 표시용: ExifTool 내장 프리뷰 추출 → 같은 파생본 파이프라인.
- 배치: ExifTool stay_open, 임베딩 32장 단위, 워커 동시성은 HDD를 배려해 2~4.
- 스캔 주기 30분 기본. 밤에 HDD를 재우고 싶으면 스캔 시간대 제한 설정.
- 백업: `pg_dump` 일 1회. 파생본은 재생성 가능, 원본은 앱이 안 건드린다.

---

## 9. 로드맵

| 단계 | 내용                                                                                                                                                                  | 끝나면 보이는 것                                     |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| 0    | SvelteKit 스캐폴드, compose(5 컨테이너), Drizzle 마이그레이션, 디자인 토큰·서체·레이아웃 셸                                                                           | 빈 사이트가 이미 작가 사이트처럼 생김                |
| 1    | 관리자 로그인(최소) + Source 등록(폴더 선택기) → 주기 스캔 → ExifTool → 파생본(SSD) → `/library/{slug}` → `/archive` → 사진 페이지 + 스펙 시트 → **필름 스트립 랜딩** | 내 사진이 전부 보이고 랜딩이 흐른다 (ML·페어링 없이) |
| 2    | 페어링 + 원본⇄보정 토글(다중 보정 칩) + tier + 컬렉션 + 롤 메타                                                                                                       | 포트폴리오로서 완성                                  |
| 3    | Immich에서 모델 벤치 → `ml` 컨테이너 + 임베딩 + 한글 검색 + 유사 사진 + 필터                                                                                          | 검색이 된다                                          |
| 4    | 관리자 UI 마감(페어링 검토, 컬렉션 에디터, 설정 페이지 = `settings` 테이블), OG 미리보기, 반응형, 접근성                                                              | 남에게 링크를 줄 수 있다                             |
| 5    | 분할 비교, 지도, 컨택트시트 모드, 공유 링크, 라이트 테마, VLM 캡션·OCR, TOTP                                                                                          | 취향                                                 |

1단계부터 게스트가 볼 수 있는 상태를 유지한다.

---

## 10. 결정 기록

확정(2026-10-08)

1. 스택: SvelteKit(TypeScript 풀스택). §4 그대로.
2. GPU: Debian VM에 `/dev/dri/{card0,card1,renderD128}` 보임 → `ml` 컨테이너에 `/dev/dri` 전달.
3. 필름 이름 규칙: 폴더 `YYMM_RR 카메라 - 필름`, 파일 `YYMM_RR_NNN`. 폴더가 적어서 지금 바꾼다.
4. 보정 없는 원본은 공개 사이트에서 기본 비공개. 관리자는 라이브러리 페이지(§2.4)에서 전부 본다. 표시는 RAW 우선, 없으면 JPG.
5. 랜딩은 A컷만. 프레임 클릭 → 사진 페이지 오버레이(§7.1).

추가 확정

6. 배포: GitHub `NR2BJ/ShowMeThePicture` → GHCR 이미지 → Portainer Repository 스택. 설정은 §8.1 경계대로.

남은 것

- B컷 폴더 이름(Source 등록 때 필요).
- Immich 가동 여부와 모델 벤치 결과(3단계 들어갈 때).
