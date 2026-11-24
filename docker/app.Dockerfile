# app 과 worker 가 공유하는 이미지.
# - perl: exiftool-vendored 가 리눅스에서 시스템 perl 을 쓴다
# - sharp 는 libvips 를 내장 바이너리로 가져온다 (HEVC 로 된 HEIC·JPEG XL 은 못 읽는다)
# - libheif-examples(heif-convert)·libjxl-tools(djxl): HEIC·JXL 을 PNG 로 풀어 sharp 에 넘긴다 (derive.ts)
# - 런타임은 entrypoint 가 PUID/PGID(기본 1000:1000)로 권한을 내려서 실행한다
FROM node:22-bookworm-slim

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN apt-get update \
	&& apt-get install -y --no-install-recommends perl ca-certificates util-linux libheif-examples libjxl-tools \
	&& rm -rf /var/lib/apt/lists/* \
	&& corepack enable

WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
# devDependencies 도 설치한다: worker 와 마이그레이션이 tsx 로 소스를 직접 실행한다.
RUN pnpm install --frozen-lockfile --prod=false

COPY . .
RUN pnpm build && chmod +x docker/entrypoint.sh

ENV NODE_ENV=production
EXPOSE 3000
ENTRYPOINT ["/app/docker/entrypoint.sh"]
CMD ["node", "build"]
