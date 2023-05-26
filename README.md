# Franklin Site Status

Franklin Site Status is a project to monitor the status of a set of websites. The system queries Github's APIs to get a list of websites, runs audits on these sites using Google's PageSpeed Insights API, and then stores the results in MongoDB.

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

2. Install dependencies for each module (server, import-worker, audit-worker).

```bash
cd server && npm install
cd ../import-worker && npm install
cd ../audit-worker && npm install
cd ..
```

3. Configure environment variables.

Copy `.env.example` to `.env` in the root directory and fill in your details.

```bash
cp .env.example .env
```

Here is the list of environment variables in the `.env` file:

- `MONGODB_URI`: The connection string for your MongoDB database.
- `PAGESPEED_API_KEY`: Your Google PageSpeed Insights API key.
- `GITHUB_CLIENT_ID`: Your Github App client id.
- `GITHUB_CLIENT_SECRET`: Your Github App client secret.
- `GITHUB_ORG`: The name of the Github organization whose repositories should be audited.
- `USER_API_KEY`: A secret key used for authorizing API requests.
- `ADMIN_API_KEY`: A secret key used for authorizing admin operations.

4. Build Docker images.

```bash
npm run build:docker
```

5. Run Docker Compose.

```bash
docker-compose up
```

The application will now be running, and you can view it in your browser at `http://localhost:3000`.

## API Endpoints

- `GET /api/status/:domain`: Get the latest audit status for a given domain.
- `GET /api/sites`: Get a list of all sites with the latest audit results, sorted by the performance score in ascending order.

## Workers

There are two worker processes:

1. **Import Worker** (`import-worker`): This worker fetches a list of repositories from a Github organization, extracts the website URLs, and stores them in the database. The worker is scheduled to run daily, but can also be triggered manually via the admin page.

2. **Audit Worker** (`audit-worker`): This worker fetches one site at a time from the database, runs an audit using the PageSpeed Insights API, and stores the results in the database. The worker runs continuously, auditing each site once per day.

## MongoDB Collections

There are two main collections in the MongoDB database:

- `sites`: This collection contains a document for each website. Each document contains the domain, the associated Github URL, and a timestamp for the last audit.

- `audits`: This collection contains the audit results. Each audit is a document containing the domain, the audit result (a JSON object returned by the PageSpeed Insights API), a flag indicating if an error occurred during the audit, the error message (if any), and a timestamp.

## Authenticating API Requests

All API requests should include an `X-API-KEY` header for authentication. The value of the header should be either the `USER_API_KEY` or `ADMIN_API_KEY` as defined in your `.env` file.

Example of including the `X-API-KEY` in a curl request:

```bash
curl -H "X-API-KEY: your-api-key" http://localhost:3000/api/status/example.com
```

## Production Deployment

For production deployment, we recommend using Kubernetes. We've provided a set of Kubernetes manifests in the `k8s` directory for deploying the application to a Kubernetes cluster.

To use the Kubernetes manifests, you'll need to replace the placeholders in the `secrets.yaml` file with your actual secrets.

This can be done using `kubectl` with the following commands:

```bash
kubectl create secret generic franklin-status-secrets \
  --from-literal=MONGODB_URI=your-mongodb-connection-string \
  --from-literal=PAGESPEED_API_KEY=your-pagespeed-api-key \
  --from-literal=GITHUB_CLIENT_ID=your-github-app-id \
  --from-literal=GITHUB_CLIENT_SECRET=your-github-app-secret \
  --from-literal=GITHUB_ORG=your-github-org \
  --from-literal=USER_API_KEY=your-user-api-key \
  --from-literal=ADMIN_API_KEY=your-admin-api-key
```

Replace the `your-*` placeholders with your actual values. This command will create a Kubernetes Secret called `franklin-status-secrets` in your current namespace, which will be used by the deployment.

Once the secret is created, you can deploy the application using `kubectl`:

```bash
kubectl apply -f k8s
```

This command will create the deployments and services defined in the `k8s` directory. Ensure that your Kubernetes context is set to the correct cluster and namespace before running this command.

After deployment, the application should be accessible via the service `franklin-status-service`.

Please note that you'll need to have a valid Kubernetes context and appropriate permissions to create resources in your Kubernetes cluster.

## Github App Credentials

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
