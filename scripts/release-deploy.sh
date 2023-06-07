#!/bin/bash

set -e
trap 'echo "Error in release-deploy.sh line $LINENO"' ERR

ENV_FILE=".env.${1:-dev}"
source "$ENV_FILE"

VERSION=$(npm run version --silent)

./scripts/release.sh "$DOCKER_REGISTRY_URL" "$VERSION"
./scripts/deploy.sh "$KUBE_CONTEXT" "$KUBE_NAMESPACE" "$DOCKER_REGISTRY_URL" "$VERSION"
