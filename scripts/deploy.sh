#!/bin/bash
set -e
trap 'echo "Deploy script failed on line $LINENO"' ERR

source "$1"
VERSION="$2"

echo "Deploying version $VERSION"

kubectl config use-context "$KUBE_CONTEXT"

if ! kubectl get secret regcred --context "$KUBE_CONTEXT" -n "$KUBE_NAMESPACE" >/dev/null 2>&1; then
  kubectl create secret docker-registry regcred --context "$KUBE_CONTEXT" -n "$KUBE_NAMESPACE" \
    "--docker-server=$DOCKER_REGISTRY_URL" \
    --docker-username="$DOCKER_USERNAME" \
    --docker-password="$DOCKER_PASSWORD"
fi

if ! kubectl get secret franklin-site-status-secrets --context "$KUBE_CONTEXT" -n "$KUBE_NAMESPACE" >/dev/null 2>&1; then
  kubectl create secret -n "$KUBE_NAMESPACE" generic franklin-site-status-secrets \
    --from-literal=mongodb-uri="$MONGODB_URI" \
    --from-literal=audit-ttl-days="$AUDIT_TTL_DAYS" \
    --from-literal=audit-interval-in-hours="$AUDIT_INTERVAL_IN_HOURS" \
    --from-literal=pagespeed-api-key="$PAGESPEED_API_KEY" \
    --from-literal=github-client-id="$GITHUB_CLIENT_ID" \
    --from-literal=github-client-secret="$GITHUB_CLIENT_SECRET" \
    --from-literal=user-api-key="$USER_API_KEY" \
    --from-literal=admin-api-key="$ADMIN_API_KEY" \
    --from-literal=slack-signing-secret="$SLACK_SIGNING_SECRET" \
    --from-literal=slack-bot-token="$SLACK_BOT_TOKEN"
fi

kubectl apply -f k8s -n "$KUBE_NAMESPACE"
kubectl set image deployment/franklin-site-status-audit-worker audit-worker="$DOCKER_REGISTRY_URL"/franklin/site-status-audit-worker:"$VERSION" -n "$KUBE_NAMESPACE"
kubectl set image deployment/franklin-site-status-server site-status-server="$DOCKER_REGISTRY_URL"/franklin/site-status-server:"$VERSION" -n "$KUBE_NAMESPACE"
