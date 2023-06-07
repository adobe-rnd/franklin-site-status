#!/bin/bash

set -e
trap 'echo "Error in release-deploy.sh line $LINENO"' ERR

ENV_FILE=".env.${1:-development}"
VERSION=$(jq -r ".version" package.json)

./scripts/release.sh "$ENV_FILE" "$VERSION"
./scripts/deploy.sh "$ENV_FILE" "$VERSION"
