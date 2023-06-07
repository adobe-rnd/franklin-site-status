#!/bin/bash

set -e
trap 'echo "Error in release-deploy.sh line $LINENO"' ERR

ENV_FILE=".env.${1:-development}"
source "$ENV_FILE"

VERSION=$(jq -r ".version" package.json)

./scripts/release.sh "$DOCKER_REGISTRY_URL" "$VERSION"
./scripts/deploy.sh "$KUBE_CONTEXT" "$KUBE_NAMESPACE" "$DOCKER_REGISTRY_URL" "$VERSION"
