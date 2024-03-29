# Franklin Site Status

Franklin Site Status is a project to monitor the status of a set of websites. The system runs audits on a list of sites using Google's PageSpeed Insights API, and then stores the results in MongoDB.

## Dependencies

- Node.js (>= v18)
- MongoDB
- Docker and Docker Compose

## Setup

1. Clone the repository.

```bash
git clone https://github.com/adobe-rnd/franklin-site-status.git
cd franklin-site-status
```

2. Install dependencies for each module (server, audit-worker).

```bash
cd server && npm install
cd ../audit-worker && npm install
cd ..
```

3. Configure environment variables.

Copy `development.env` to `.env` in the root directory and fill in your details.

```bash
cp development.env .env
```

Here is the list of environment variables in the `.env` file:

- `MONGODB_URI`: The connection string for your MongoDB database.
- `AUDIT_TTL_DAYS`: The number of days to keep audit results in the database.
- `PAGESPEED_API_KEY`: Your Google PageSpeed Insights API key.
- `GITHUB_CLIENT_ID`: Your Github App client id.
- `GITHUB_CLIENT_SECRET`: Your Github App client secret.
- `USER_API_KEY`: A secret key used for authorizing API requests.
- `ADMIN_API_KEY`: A secret key used for authorizing admin operations.
- `RABBITMQ_USERNAME`: Username needed for message broker
- `RABBITMQ_PASSWORD`: Password needed for message broker
- `RABBITMQ_SERVICE_SERVICE_HOST`: Hostname of broker
- `RABBITMQ_SERVICE_SERVICE_PORT`: Port of broker - set to 5672
- `AUDIT_TASKS_QUEUE_NAME`: Queue name to process audit tasks
- `AUDIT_RESULTS_QUEUE_NAME`: Queue name for the audit results

4. Build Docker images.

```bash
npm run build:docker
```

5. Run Docker Compose.

```bash
docker-compose up
```

The web server will now be running, and you can view it in your browser at `http://localhost:8000`.

## API Endpoints

- `GET /api/status/:domain`: Get the latest audit status for a given domain.
- `GET /api/sites`: Get a list of all sites with the latest audit results, sorted by the performance score in ascending order.

### Authenticating API Requests

All API requests should include an `X-API-KEY` header for authentication. The value of the header should be either the `USER_API_KEY` or `ADMIN_API_KEY` as defined in your `.env` file.

Example of including the `X-API-KEY` in a curl request:

```bash
curl -H "X-API-KEY: your-api-key" http://localhost:8000/api/status/example.com
```

## Workers

There is one worker process:

1. **Audit Worker** (`audit-worker`): This worker fetches one site at a time from the database, runs an audit using the PageSpeed Insights API, and stores the results in the database. The worker runs continuously, auditing each site once per day.

## MongoDB Collections

There are two main collections in the MongoDB database:

- `sites`: This collection contains a document for each website. Each document contains the domain, the associated Github URL. 
- `audits`: This collection contains a document for each audit. Each document contains the `auditResults`, the associated `siteId`, and a timestamp for the audit. 

# Release

To release a specific version (previously built and exists on local machine), run the following command:

./scripts/release.sh "release.env" "VERSION"

`release.env` should contain following values:

```
DOCKER_REGISTRY_URL=$DOCKER_REGISTRY_URL
DOCKER_USERNAME=$DOCKER_USERNAME
DOCKER_PASSWORD=$DOCKER_PASSWORD
```

# Deployment

For deployment, we recommend using Kubernetes. We've provided a set of Kubernetes manifests in the `k8s` directory for deploying the application to a Kubernetes cluster.

## Pre-requisites
Pre-requisites for deployment:
- docker, kubectl > 1.21 and jq
- Create a secrets file `secrets.env` file under `/k8s/dev/` or `k8s/prod` depending on which environment to be deployed. For example, to deploy dev env:
  ```
  mongodb-uri=${MONGODB_URI}
  rabbitmq-username=${RABBITMQ_USERNAME}
  rabbitmq-password=${RABBITMQ_PASSWORD}
  pagespeed-api-key=${PAGESPEED_API_KEY}
  github-client-id=${GITHUB_CLIENT_ID}
  github-client-secret=${GITHUB_CLIENT_SECRET}
  user-api-key=${USER_API_KEY}
  admin-api-key=${ADMIN_API_KEY}
  slack-signing-secret=${SLACK_SIGNING_SECRET}
  slack-bot-token=${SLACK_BOT_TOKEN}


## Ethos Contexts and Namespaces
- Development: ethos09-prod-va7, ns-team-ns-team-sites-xp-space-cat-dev
- Production: ethos05-prod-va7, ns-team-sites-xp-space-cat

## Deployment

Once you have `secrets.env` under `/k8s/{env}`, you can run `kustomize` to deploy to desired env. Make sure to change the kube context (in prev section) to correct cluster & namespace before running the following command:

Each `kustomization.yaml` file contains tags of the images to be deployed. Make sure you set the tags to correct versions before deploying. 

for development cluster:

```shell
kubectl apply -k k8s/dev
```

for production cluster:

```shell
kubectl apply -k k8s/prod
```

# Kubernetes Resource Requirements
## Audit Worker

### Overview
The Audit Worker is a service designed to conduct audits on a list of websites. The worker connects to a MongoDB instance, retrieves the next website to audit, performs the audit using Google's Lighthouse service, and then stores the result of the audit in the MongoDB instance. The audits are spread evenly throughout the day, and the worker is designed to process approximately 300 audits daily.

### Resource Requirements

#### CPU
The worker's operations are mostly network-bound and not highly CPU-intensive. Therefore, it is recommended to start with a low to medium CPU allocation (0.5 - 1 vCPU should suffice), and adjust based on observed performance.

#### Memory
The memory requirements are largely dependent on the size of the audit data from each website. However, a modest amount of memory (256Mi - 512Mi) should be enough.

#### Disk
The worker does not require substantial disk space. However, a moderate allocation should be provided to accommodate for logs and potential temporary files. A few gigabytes (e.g., 5GB) should be more than enough.

### Security Recommendations

- Store environment variables securely. Kubernetes Secrets, or a third-party secret manager, can be used for this purpose.
- The Pagespeed API Key (`PAGESPEED_API_KEY`) and the MongoDB URI (`MONGODB_URI`) should not be hardcoded in the codebase and should be injected into the environment securely.
- Ensure the API is accessed over HTTPS.
- Handle all the incoming data securely, sanitizing and validating it as necessary.

## MongoDB

### Overview
MongoDB is a NoSQL database used by the Audit Worker to store website audit data. The database runs in a separate container within the same deployment.

### Resource Requirements

#### CPU
MongoDB can be quite CPU-intensive, especially when handling large datasets or complex queries. A medium CPU allocation might be suitable (1-2 vCPUs should suffice).

#### Memory
MongoDB uses memory-mapped files to handle its data, the more memory, the better the performance. A memory allocation between 1 and 2 GB might be a reasonable starting point.

#### Disk
Given the TTL of 30 days for audit data, the required disk space will depend on the size of each audit document and the total number of documents stored within the 30-day period.

Assuming an average size of a Lighthouse audit document is around 100KB (this would vary depending on the website), you would accumulate approximately 9GB of data in a month for 300 audits per day.

However, MongoDB also needs space for indexes, logs, and temporary files, and it's a good practice to have some extra room to handle unexpected growth or spikes in data. Therefore, it would be recommended to allocate at least 15-20GB to ensure sufficient space for smooth operations.

Remember to monitor disk usage over time and adjust as necessary. If you see disk usage consistently rising to near the limit, it may be necessary to increase the allocated space or adjust your data retention settings.

> Please note that these are rough estimates and actual disk usage might be different. It is recommended to analyze your own workload for a more accurate estimation. Regular monitoring of the MongoDB instance is strongly advised to prevent any performance issues due to lack of disk space.

### Persistence
Since MongoDB is a stateful application, data should persist across restarts. In Kubernetes, this can be achieved by using Persistent Volumes (PV) and Persistent Volume Claims (PVC).

### Security Recommendations

- Secure communication between the MongoDB instance and the Audit Worker service. This can be accomplished through network policies or by enabling MongoDB's built-in transport encryption.
- Apply least privilege access controls to your MongoDB instance. Only the necessary users and roles should be able to interact with the database.
- Regularly update MongoDB to the latest version to benefit from the latest security fixes and improvements.

> Please note that these are general recommendations and may vary based on actual workload and performance analysis. It is recommended to take a more precise approach like performing load tests and observing the performance to decide the optimal resource allocation. Regular monitoring of the services is strongly recommended.

## Node Express Server

The Node Express Server provides the APIs to fetch site audit data. It makes use of MongoDB for data persistence and Express.js for handling HTTP requests.

### Resource Recommendations

#### CPU
The Node Express Server is not expected to have heavy CPU requirements unless under high request load. To start, you might allocate around 0.5 CPU.

#### Memory
The memory usage will depend on the number of requests being processed and the amount of data being returned by the APIs. It is recommended to start with an allocation of around 1GB.

#### Disk
The Node Express Server does not require dedicated disk space as it operates in-memory and directly interacts with the MongoDB database. Hence, no additional disk space is needed.

### Security Recommendations

- **Environment Variables**: The server uses environment variables for sensitive data such as the MongoDB URI and API keys. Ensure these are stored securely and are not exposed in any logs or error messages.

- **API Key Verification**: The server includes middleware for API key verification. Ensure that this is correctly implemented and used on all routes that require authentication.

- **Error Handling**: Make sure to handle all errors correctly. Never expose sensitive information in error messages.

- **Input Validation**: Always validate input before processing it. Never trust data received in a request without validating it first.

- **Network Policies**: Consider restricting network access to the server, allowing only necessary traffic. In Kubernetes, this can be achieved using Network Policies.

- **Rate Limiting**: Consider implementing rate limiting on your API endpoints to prevent abuse.

- **HTTPS**: All data should be transmitted over HTTPS. This ensures that the information is encrypted and can't be easily intercepted.

> **Note:** These are general recommendations. Actual resource usage can vary based on the number of requests and the amount of data returned. Regular monitoring and adjusting resources based on usage is always a good practice.

# Github App Credentials

To interact with Github's APIs, you'll need a Github App Client ID and Client Secret. Follow these steps to create one:

1. Visit https://github.com/settings/apps
2. Click on 'New Github App'.


3. Fill in the form with your details.
4. Under 'Permissions', set 'Repositories' to 'Read' access for 'Repository metadata'.
5. Click 'Create Github App'.
6. On the app details page, you'll find the Client ID and Client Secret.

## Google PageSpeed Insights API Key

To use the Google PageSpeed Insights API, you'll need an API key. Here's how you can get one:

1. Visit https://console.cloud.google.com/apis/credentials
2. If you haven't created a project yet, do so by clicking on 'Create Project' and following the prompts.
3. Once you've created a project, click on 'Create Credentials'.
4. Select 'API Key' in the dropdown menu.
5. You'll be presented with your new API key. Make sure to copy it and keep it somewhere safe.

# RabbitMQ

## Endpoints:

Dev: https://spacecat-rabbitmq.corp.ethos05-prod-va7.ethos.adobe.net/#/queues

Prod: https://spacecat-rabbitmq.corp.ethos09-prod-va7.ethos.adobe.net/#/queues
