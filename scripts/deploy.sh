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

 docker image tag franklin-site-status-server:latest docker-experience-success-release.dr-uw2.adobeitc.com/franklin/site-status-server:latest
 docker image push docker-experience-success-release.dr-uw2.adobeitc.com/franklin/site-status-server:latest

 docker image tag franklin-site-status-audit-worker:latest docker-experience-success-release.dr-uw2.adobeitc.com/franklin-site-status-audit-worker:latest
 docker image push docker-experience-success-release.dr-uw2.adobeitc.com/franklin-site-status-audit-worker:latest

 docker image tag franklin-site-status-import-worker:latest docker-experience-success-release.dr-uw2.adobeitc.com/franklin/site-status-import-worker:latest
 docker image push docker-experience-success-release.dr-uw2.adobeitc.com/franklin/site-status-import-worker:latest


 kubectl apply -f k8s/audit-worker-deployment.yaml -n ns-team-sites-xp-space-cat
 kubectl apply -f k8s/egress.yaml -n ns-team-sites-xp-space-cat
 kubectl apply -f k8s/server-deployment.yaml -n ns-team-sites-xp-space-cat
 kubectl apply -f k8s/mongo-statefulset.yaml -n ns-team-sites-xp-space-cat
 kubectl apply -f k8s/import-worker-deployment.yaml -n ns-team-sites-xp-space-cat





