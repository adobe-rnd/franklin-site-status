#!/bin/bash

set -e
trap 'echo "Error in deploy.sh line $LINENO"' ERR

CONTEXT=$1
NAMESPACE=$2
DOCKER_REGISTRY_URL=$3
VERSION=$4

if ! kubectl get secret regcred --context "$CONTEXT" -n "$NAMESPACE" >/dev/null 2>&1; then
  kubectl create secret docker-registry regcred --context "$CONTEXT" -n "$NAMESPACE" \
    --docker-server="$DOCKER_REGISTRY_URL" \
    --docker-username="$DOCKER_USERNAME" \
    --docker-password="$DOCKER_PASSWORD"
fi

if ! kubectl get secret franklin-site-status-secrets --context "$CONTEXT" -n "$NAMESPACE" >/dev/null 2>&1; then
  kubectl create secret -n "$NAMESPACE" generic franklin-site-status-secrets \
    --from-literal=mongodb-uri="$MONGODB_URI" \
    --from-literal=audit-ttl-days="$AUDIT_TTL_DAYS" \
    --from-literal=pagespeed-api-key="$PAGESPEED_API_KEY" \
    --from-literal=github-client-id="$GITHUB_CLIENT_ID" \
    --from-literal=github-client-secret="$GITHUB_CLIENT_SECRET" \
    --from-literal=github-org="$GITHUB_ORG" \
    --from-literal=user-api-key="$USER_API_KEY" \
    --from-literal=admin-api-key="$ADMIN_API_KEY" \
    --from-literal=slack-signing-secret="$SLACK_SIGNING_SECRET" \
    --from-literal=slack-bot-token="$SLACK_BOT_TOKEN"
fi

kubectl apply -f k8s -n "$NAMESPACE"
kubectl set image deployment/franklin-site-status-audit-worker audit-worker="$DOCKER_REGISTRY_URL"/site-status-audit-worker:"$VERSION" -n "$NAMESPACE"
kubectl set image cronjob/franklin-status-import-worker-cronjob import-worker="$DOCKER_REGISTRY_URL"/site-status-import-worker:"$VERSION" -n "$NAMESPACE"
kubectl set image deployment/franklin-site-status-server node-express-server="$DOCKER_REGISTRY_URL"/site-status-server:"$VERSION" -n "$NAMESPACE"
