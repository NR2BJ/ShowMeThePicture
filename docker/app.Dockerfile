# app 과 worker 가 공유하는 이미지.
# - perl: exiftool-vendored 가 리눅스에서 시스템 perl 을 쓴다
# - sharp 는 libvips 를 내장 바이너리로 가져온다 (HEIC 제외)
# - 런타임은 entrypoint 가 PUID/PGID(기본 1000:1000)로 권한을 내려서 실행한다
FROM node:22-bookworm-slim

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN apt-get update \
	&& apt-get install -y --no-install-recommends perl ca-certificates util-linux \
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
