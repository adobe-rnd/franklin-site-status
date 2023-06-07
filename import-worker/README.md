# Franklin Site Status Import Worker

## Table of Contents
- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Data Model](#data-model)
- [Working Principle](#working-principle)
- [APIs](#apis)
- [Error Handling](#error-handling)
- [Docker Usage](#docker-usage)

## Overview
The Franklin Site Status Import Worker is a Node.js application designed to interact with GitHub's APIs to fetch data from a GitHub organization's public repositories. The worker then processes the repository information and stores it in a MongoDB database. The worker is designed to handle GitHub API pagination and can work with large amounts of data efficiently.

## Prerequisites
- Node.js 18.x
- npm 7.x
- Access to a MongoDB database
- GitHub API credentials

## Installation
1. Clone the repository:
    ```
    git clone https://github.com/your_username/franklin-site-status-import-worker.git
    ```
2. Navigate into the project directory:
    ```
    cd franklin-site-status-import-worker
    ```
3. Install the dependencies:
    ```
    npm ci
    ```

## Configuration
The worker uses environment variables for configuration. The following variables need to be set:

- `GITHUB_CLIENT_ID`: Your GitHub client ID
- `GITHUB_CLIENT_SECRET`: Your GitHub client secret
- `GITHUB_ORG`: The GitHub organization from which to fetch public repositories
- `MONGODB_URI`: The connection URI for your MongoDB database

You can set these environment variables directly in your environment, or you can use a `.env` file.

## Data Model
The worker stores site data in a MongoDB collection called 'sites'. Each site document has the following fields:

- `githubId`: The ID of the repository on GitHub
- `createdAt`: The date the site was first added to the database
- `lastAudited`: The date the site was last audited
- `audits`: An array of audits for the site
- `domain`: The domain of the site
- `gitHubURL`: The URL of the GitHub repository for the site
- `gitHubOrg`: The GitHub organization name
- `updatedAt`: The date the site was last updated in the database

## Working Principle
The import worker runs in a continuous loop, fetching and processing repositories from GitHub. For each repository, it checks if it's archived. If it is, it removes the associated site from the database. If it's not archived, it adds or updates the site in the database.

When the worker finishes processing all repositories, it cleans up old audits, sets the worker running state to false, and disconnects from the database.

If an error occurs while fetching or processing repositories, the worker waits for a set amount of time and then tries again.

## APIs
The import worker uses GitHub's APIs to fetch data about an organization's public repositories. It uses the `axios` library to make HTTP requests.

## Error Handling
The import worker uses try-catch blocks to handle errors that occur during its execution. If an error occurs while fetching repositories from GitHub, the worker waits for a period of time and then tries again. If an error occurs while importing data, it logs the error and ends the function.

## Docker Usage
To run the worker in a Docker container, first, build the Docker image with the provided Dockerfile:

```
docker build -t franklin-site-status-import-worker .
```

Then, run a container from the image:

```
docker run -d -e GITHUB_CLIENT_ID=your_client_id -e GITHUB_CLIENT_SECRET=your_client_secret -e

.Highlighted Code Blocks

```javascript
// Import worker invocation
importWorker(WORKER_NAME);
```

## Configuration

Before running the application, set the following environment variables:

- `GITHUB_CLIENT_ID`: The GitHub client ID.
- `GITHUB_CLIENT_SECRET`: The GitHub client secret.
- `GITHUB_ORG`: The GitHub organization name.
- `MONGODB_URI`: MongoDB connection URI.

These environment variables are required for the import worker to function correctly.

## Data Model

The application makes use of the following MongoDB collections:

- `sites`: Stores the website data imported from GitHub repositories.
- `workerStates`: Stores the running state of the import worker.

A typical `sites` document might look like:

```json
{
  "githubId": "123456",
  "createdAt": "2022-01-01T00:00:00Z",
  "lastAudited": "2022-01-02T00:00:00Z",
  "audits": [],
  "domain": "main--example--githubOrg.hlx.live",
  "gitHubURL": "https://github.com/githubOrg/example",
  "gitHubOrg": "githubOrg",
  "updatedAt": "2022-01-02T00:00:00Z"
}
```

The `workerStates` collection documents might look like:

```json
{
  "name": "importWorker",
  "isRunning": true,
  "lastUpdated": "2022-01-01T00:00:00Z"
}
```

## Working Principle

The import worker connects to a MongoDB database and imports data from a GitHub organization's public repositories. It fetches repository data page by page until no more pages are available. For each repository, if it's archived, the associated site is removed from the database. If not, the repository's domain is extracted and added to the database along with other repository details.

If any errors occur while fetching repositories from GitHub, the worker waits for a period of time and then tries again. If an error occurs while importing data, it logs the error and ends the function.

Once all data has been imported, the worker cleans up old audits, sets its running state to false, and disconnects from the database.


The import worker is designed to operate as a cronjob, repeatedly running at specified intervals to update the database with the latest data from GitHub. This design is well-suited to environments like Kubernetes, which provide built-in support for cronjob deployments.

In a Kubernetes environment, you would typically package the worker into a Docker image, push the image to a container registry, and then create a Kubernetes CronJob that runs the worker at your desired schedule. Here's an example of what the Kubernetes CronJob YAML might look like:

```yaml
apiVersion: batch/v1beta1
kind: CronJob
metadata:
  name: site-status-import-worker
spec:
  schedule: "0 * * * *"
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: site-status-import-worker
            image: registry.example.com/franklin-site-status-import-worker:latest
            env:
            - name: GITHUB_CLIENT_ID
              valueFrom:
                secretKeyRef:
                  name: github-secrets
                  key: client-id
            - name: GITHUB_CLIENT_SECRET
              valueFrom:
                secretKeyRef:
                  name: github-secrets
                  key: client-secret
            - name: GITHUB_ORG
              value: your-github-org
            - name: MONGODB_URI
              valueFrom:
                secretKeyRef:
                  name: mongodb-secrets
                  key: uri
          restartPolicy: OnFailure
```

In this example, the CronJob runs every hour. Kubernetes creates a new Job for each run of the CronJob, and the import worker runs inside a Pod created for that Job. The environment variables for the GitHub API and MongoDB are set from Kubernetes Secrets.

## APIs

The import worker uses the following APIs:

- [GitHub's List public organization repositories API](https://docs.github.com/en/rest/reference/repos#list-organization-repositories) to fetch repositories from a GitHub organization.

The MongoDB APIs used include:

- `db.collection().createIndex()`
- `db.collection().updateOne()`
- `db.collection().deleteOne()`
- `db.collection().bulkWrite()`

## Error Handling

The import worker incorporates error handling at each stage of the process:

- If GitHub credentials are not provided, it throws an error.
- If environment variables are not set properly, it throws an error.
- If there are errors while fetching repositories from GitHub, the function waits for a period of time and tries again.
- If an error occurs while connecting, disconnecting, or interacting with the database, it logs the error and terminates the process.
- If an error occurs while running the import worker, it logs the error.

## Docker Usage

The import worker can be containerized using Docker. The provided `Dockerfile` describes the steps to create a Docker image of the import worker. This enables you to easily run the worker in any environment that supports Docker, such as Kubernetes.

To build the Docker image, navigate to the project root and run:

```bash
docker build -t franklin-site-status-import-worker .
```

After the image has been built, you can run the worker in a Docker container. Use the following command, replacing the placeholders with your actual values:

```bash
docker run --env GITHUB_CLIENT_ID=<your-client-id> --env GITHUB_CLIENT_SECRET=<your-client-secret> --env GITHUB_ORG=<your-org-name> --env MONGODB_URI=<your-mongodb-uri> -d franklin-site-status-import-worker
```

This runs the worker in the background (-d flag) and passes the necessary environment variables to the container.
