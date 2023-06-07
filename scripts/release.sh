#!/bin/bash

DOCKER_REGISTRY_URL=$1
VERSION=$2

docker login "$DOCKER_REGISTRY_URL" -u "$DOCKER_USERNAME" -p "$DOCKER_PASSWORD"
docker image tag franklin-site-status-server:"$VERSION" "$DOCKER_REGISTRY_URL"/franklin/site-status-server:"$VERSION"
docker image push "$DOCKER_REGISTRY_URL"/franklin/site-status-server:"$VERSION"

docker image tag franklin-site-status-audit-worker:"$VERSION" "$DOCKER_REGISTRY_URL"/franklin/site-status-audit-worker:"$VERSION"
docker image push "$DOCKER_REGISTRY_URL"/franklin/site-status-audit-worker:"$VERSION"

docker image tag franklin-site-status-import-worker:"$VERSION" "$DOCKER_REGISTRY_URL"/franklin/site-status-import-worker:"$VERSION"
docker image push "$DOCKER_REGISTRY_URL"/franklin/site-status-import-worker:"$VERSION"
