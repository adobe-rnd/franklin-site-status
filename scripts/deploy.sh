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
    --from-literal=admin-api-key=$ADMIN_API_KEY \
    --from-literal=slack-signing-secret=$SLACK_SIGNING_SECRET \
    --from-literal=slack-bot-token=$SLACK_BOT_TOKEN
fi

kubectl apply -f k8s -n ns-team-sites-xp-space-cat
kubectl set image deployment/franklin-site-status-worker audit-worker=docker-experience-success-release.dr-uw2.adobeitc.com/franklin/site-status-audit-worker:$1 -n ns-team-sites-xp-space-cat
kubectl set image cronjob/franklin-status-import-worker-cronjob import-worker=docker-experience-success-release.dr-uw2.adobeitc.com/franklin/site-status-import-worker:$1 -n ns-team-sites-xp-space-cat
kubectl set image deployment/franklin-site-status-server node-express-server=docker-experience-success-release.dr-uw2.adobeitc.com/franklin/site-status-server:$1 -n ns-team-sites-xp-space-cat
