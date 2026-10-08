# app 과 worker 가 공유하는 이미지.
# - perl: exiftool-vendored 가 리눅스에서 시스템 perl 을 쓴다
# - sharp 는 libvips 를 내장 바이너리로 가져온다 (HEIC 제외)
FROM node:22-bookworm-slim

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN apt-get update \
	&& apt-get install -y --no-install-recommends perl ca-certificates \
	&& rm -rf /var/lib/apt/lists/* \
	&& corepack enable

WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
# devDependencies 도 설치한다: worker 가 tsx 로 소스를 직접 실행하고, 마이그레이션도 tsx 로 돈다.
RUN pnpm install --frozen-lockfile --prod=false

COPY . .
RUN pnpm build

ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "build"]
