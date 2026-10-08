#!/bin/sh
# PUID/PGID(기본 1000:1000)로 권한을 내린 뒤 명령을 실행한다 (linuxserver 이미지와 같은 관례).
# - 원본(/photos)은 그 uid 가 읽을 수 있어야 한다 (파일 소유자가 1000 이면 그대로 맞는다).
# - 캐시(/cache)는 bind mount 가 root 소유로 만들어졌을 수 있어 소유권을 맞춘다.
set -e
PUID="${PUID:-1000}"
PGID="${PGID:-1000}"

if [ "$PUID" = "0" ]; then
	exec "$@"
fi

if [ -d /cache ]; then
	owner="$(stat -c %u /cache 2>/dev/null || echo -1)"
	if [ "$owner" != "$PUID" ]; then
		echo "[entrypoint] /cache 소유권을 ${PUID}:${PGID} 로 맞춥니다"
		chown -R "${PUID}:${PGID}" /cache || echo "[entrypoint] chown 실패 — 캐시 쓰기가 막힐 수 있습니다"
	fi
fi

export HOME=/tmp
exec setpriv --reuid="$PUID" --regid="$PGID" --clear-groups "$@"
