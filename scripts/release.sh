 docker image tag franklin-site-status-server:$1 docker-experience-success-release.dr-uw2.adobeitc.com/franklin/site-status-server:$1
 docker image push docker-experience-success-release.dr-uw2.adobeitc.com/franklin/site-status-server:$1

 docker image tag franklin-site-status-audit-worker:$1 docker-experience-success-release.dr-uw2.adobeitc.com/franklin/site-status-audit-worker:$1
 docker image push docker-experience-success-release.dr-uw2.adobeitc.com/franklin/site-status-audit-worker:$1

 docker image tag franklin-site-status-import-worker:$1 docker-experience-success-release.dr-uw2.adobeitc.com/franklin/site-status-import-worker:$1
 docker image push docker-experience-success-release.dr-uw2.adobeitc.com/franklin/site-status-import-worker:$1
