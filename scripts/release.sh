#!/bin/bash
set -e
trap 'echo "Release script failed on line $LINENO"' ERR

DOCKER_REGISTRY_URL="$1"
DOCKER_USERNAME="$2"
DOCKER_PASSWORD="$3"
VERSION="$4"

echo "Releasing version $VERSION"

docker login "$DOCKER_REGISTRY_URL" -u "$DOCKER_USERNAME" -p "$DOCKER_PASSWORD"
docker image tag franklin-site-status-server:"$VERSION" "$DOCKER_REGISTRY_URL"/franklin/site-status-server:"$VERSION"
docker image push "$DOCKER_REGISTRY_URL"/franklin/site-status-server:"$VERSION"

docker image tag franklin-site-status-audit-worker:"$VERSION" "$DOCKER_REGISTRY_URL"/franklin/site-status-audit-worker:"$VERSION"
docker image push "$DOCKER_REGISTRY_URL"/franklin/site-status-audit-worker:"$VERSION"

docker image tag franklin-site-status-import-worker:"$VERSION" "$DOCKER_REGISTRY_URL"/franklin/site-status-import-worker:"$VERSION"
docker image push "$DOCKER_REGISTRY_URL"/franklin/site-status-import-worker:"$VERSION"
