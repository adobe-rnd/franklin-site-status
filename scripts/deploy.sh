if ! kubectl get secret regcred --context ethos05-prod-va7 -n ns-team-sites-xp-space-cat >/dev/null 2>&1; then
	kubectl create secret docker-registry regcred --context ethos05-prod-va7 -n ns-team-sites-xp-space-cat \
	    --docker-server="$DOCKER_REGISTRY_URL" \
	    --docker-username="$DOCKER_USERNAME" \
	    --docker-password="$DOCKER_PASSWORD"
fi

if ! kubectl get secret franklin-site-status-secrets --context ethos05-prod-va7 -n ns-team-sites-xp-space-cat >/dev/null 2>&1; then
  kubectl create secret -n ns-team-sites-xp-space-cat generic franklin-site-status-secrets \
    --from-literal=mongodb-uri=$MONGODB_URI \
    --from-literal=audit-ttl-days=$AUDIT_TTL_DAYS \
    --from-literal=pagespeed-api-key=$PAGESPEED_API_KEY \
    --from-literal=github-client-id=$GITHUB_CLIENT_ID \
    --from-literal=github-client-secret=$GITHUB_CLIENT_SECRET \
    --from-literal=github-org=$GITHUB_ORG \
    --from-literal=user-api-key=$USER_API_KEY \
    --from-literal=admin-api-key=$ADMIN_API_KEY
fi

kubectl apply -f k8s -n ns-team-sites-xp-space-cat
