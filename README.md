# Franklin Site Status

Franklin Site Status is a service that fetches repositories from a given GitHub organization, extracts their websites' domains, and runs Google's Lighthouse audits on them periodically. It provides a JSON API endpoint to query the audit status of a given domain.

The service consists of three parts:

1. Import Worker: Fetches the repositories and extracts the domains
2. Audit Worker: Runs Lighthouse audits on the domains
3. Server: Provides the API endpoints

## Prerequisites

- Docker and Docker Compose installed
- Node.js 18.x installed
- A MongoDB instance (for local development, this is included in the Docker Compose setup)
- Google PageSpeed API key
- GitHub personal access token

## Local Development Setup

1. Clone the repository:
    ```
    git clone https://github.com/adobe-rnd/franklin-site-status.git
    ```
2. Navigate into the project directory:
    ```
    cd franklin-site-status
    ```
3. Install the dependencies for each package:
    ```
    cd import-worker && npm install
    cd ../audit-worker && npm install
    cd ../server && npm install
    cd ../shared && npm install
    ```
4. Set your environment variables in the `.env` file:
    ```
    GOOGLE_API_KEY=<your-google-api-key>
    GITHUB_TOKEN=<your-github-token>
    GITHUB_ORG=<github-org-name>
    MONGO_URI=mongodb://mongo:27017/franklin-status
    USER_API_KEY=<your-user-api-key>
    ADMIN_API_KEY=<your-admin-api-key>
    ```
5. Start the service with Docker Compose:
    ```
    docker-compose up
    ```
6. The server should now be running at `http://localhost:8000`.

## Testing

To run the tests for the packages, navigate into each package directory and run `npm test`.

## Deployment

The service can be deployed to a Kubernetes cluster. Sample Kubernetes manifests are provided in the `k8s` directory. Please make sure to create the required Kubernetes secrets as described in the Kubernetes Secrets section below.

### Kubernetes Secrets

Sensitive information like the Google API key and GitHub token are stored in Kubernetes secrets. Create a `secrets.yaml` file (do not check this into source control) with the following structure:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: franklin-secrets
type: Opaque
stringData:
  GOOGLE_API_KEY: <your-google-api-key>
  GITHUB_TOKEN: <your-github-token>
  USER_API_KEY: <your-user-api-key>
  ADMIN_API_KEY: <your-admin-api-key>
  MONGO_URI: <your-mongo-uri>
  GITHUB_ORG: <github-org-name>
```

Replace the placeholders with your actual data. Apply the secrets using `kubectl apply -f secrets.yaml`.

## API Endpoints

1. `GET /status/:domain`: Returns the status of a given domain. Replace `:domain` with the domain you're interested in.

2. `GET /sites`: Returns all sites with their audits, sorted by the Lighthouse performance score in descending order.

3. `POST /import`: Triggers a manual import of repositories and domains.

The API endpoints are protected by API keys. Use the `USER_API_KEY` for read-only access to the `GET` endpoints. Use the `ADMIN_API_KEY` for access to the `POST /import` endpoint.

## Admin Interface

The admin interface can be accessed at `http://localhost:8000/admin.html` (or replace `localhost:8000` with your actual server address). From here, you can see the list of imported
