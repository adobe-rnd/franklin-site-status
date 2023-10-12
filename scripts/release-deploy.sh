#!/bin/bash

set -e
trap 'echo "Error in release-deploy.sh line $LINENO"' ERR

ENV_FILE="${1:-development}.env"
VERSION=$(jq -r ".version" package.json)

./scripts/release.sh "$ENV_FILE" "$VERSION"
./scripts/deploy.sh "$ENV_FILE" "$VERSION"
