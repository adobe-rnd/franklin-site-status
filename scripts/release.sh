#!/bin/bash
set -e
trap 'echo "Release script failed on line $LINENO"' ERR

source "$1"
VERSION="$2"

echo "Releasing version $VERSION"

docker login "$DOCKER_REGISTRY_URL" -u "$DOCKER_USERNAME" -p "$DOCKER_PASSWORD"
docker image tag franklin-site-status-server:"$VERSION" "$DOCKER_REGISTRY_URL"/franklin/site-status-server:"$VERSION"
docker image push "$DOCKER_REGISTRY_URL"/franklin/site-status-server:"$VERSION"

docker image tag franklin-site-status-audit-worker:"$VERSION" "$DOCKER_REGISTRY_URL"/franklin/site-status-audit-worker:"$VERSION"
docker image push "$DOCKER_REGISTRY_URL"/franklin/site-status-audit-worker:"$VERSION"
