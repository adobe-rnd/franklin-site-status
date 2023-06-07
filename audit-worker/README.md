# Franklin Site Status Audit Worker

## Table of Contents
- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Data Model](#data-model)
- [Working Principle](#working-principle)
- [APIs](#apis)
- [Docker Usage](#docker-usage)

## Overview

The Franklin Site Status Audit Worker is a Node.js application designed to perform scheduled audits on websites. It leverages Google's PageSpeed Insights (PSI) API to analyze the performance of a website and saves the audit data into a MongoDB database.

The worker is built to ensure that each site is audited once every 24 hours, effectively providing a daily performance snapshot of all audited websites.

## Prerequisites

To run this worker, you need to have:
- Node.js (v14 or later)
- MongoDB (v4 or later)
- An API key for Google's PageSpeed Insights API
- Docker (optional, for Docker deployment)

## Installation

1. Clone this repository.
2. Navigate into the project directory: `cd franklin-site-status-audit-worker`.
3. Install the necessary packages: `npm install`.

## Configuration

Configuration for this worker involves setting up the environment variables. Create a `.env` file in the root directory of the project and define the following variables:

- `MONGODB_URI`: MongoDB connection string.
- `PAGESPEED_API_KEY`: Your Google PageSpeed Insights API key.
- `AUDIT_TTL_DAYS`: The number of days before an audit expires.

## Data Model

This worker interacts with two collections in MongoDB: `sites` and `workerStates`.

Thank you for the correction. Here's the updated information.

### Sites Collection

Each document in the `sites` collection represents a site to be audited and has the following structure:

```json
{
  "domain": "example.com",
  "lastAudited": "<timestamp>",
  "audits": [
    {
      "auditedAt": "<timestamp>",
      "isError": false,
      "auditResult": {}
    },
    // More audits
  ]
}
```

In this structure, the `lastAudited` property records the timestamp of the latest audit attempt (whether it was successful or not). It is updated every time an audit is initiated for a site.

In the `audits` array, each audit includes an `auditedAt` timestamp which is set when the audit is performed. If an error occurs during the audit, the `isError` property is set to `true` and the `auditResult` is replaced with an `errorMessage`.

Here's how an audit error is represented:

```json
{
  "audits": [
    {
      "auditedAt": "<timestamp>",
      "isError": true,
      "errorMessage": "<error message>"
    },
    // More audits
  ]
}
```

In this case, the `errorMessage` property contains details of the error that occurred during the audit. This error information is invaluable for debugging and troubleshooting purposes, and also allows users to track the health of their sites over time.

### WorkerStates Collection

Each document in the `workerStates` collection represents the state of a worker:

```json
{
  "name": "auditWorker",
  "isRunning": true,
  "lastUpdated": "<timestamp>"
}
```

## Working Principle

The audit worker follows this algorithm:

1. Connect to the MongoDB database.
2. Set the worker's state to running.
3. Begin an audit cycle:
    - Retrieve the next site to audit (the one that has not been audited yet, or the one that was last audited).
    - If there are no sites to audit, sleep for a minute and then continue to the next cycle.
    - Determine if the site requires an audit:
        - If the site was audited less than 24 hours ago, skip the audit.
        - If not, perform the PSI check for the site and save the audit data to the database.
4. After each cycle, sleep for a minute before starting the next cycle.
5. If the worker is interrupted (by SIGINT or SIGTERM), update its running state to false and disconnect from the database.

## Code Structure

This project contains three main files:

- `audit-worker.js`: This is the main worker script which handles the auditing logic.
- `db.js`: This file handles all the database operations like connecting to the MongoDB database, creating indexes, fetching the next site to audit, saving the audit result, and more.
- `util.js`: This file contains utility functions like performing the PageSpeed Insights check and sleeping for a certain amount of time.

## Docker Usage

This project includes a Dockerfile for building a Docker image of the audit worker. Here are the steps to build and run the Docker image:

### 1. Build the Docker image
```sh
docker build -t franklin-audit-worker .
```

### 2. Run the Docker container
```sh
docker run -e MONGODB_URI=your_mongodb_uri -e PAGESPEED_API_KEY=your_pagespeed_api_key franklin-audit-worker
```

Replace `your_mongodb_uri` and `your_pagespeed_api_key` with your MongoDB URI and PageSpeed Insights API Key respectively.

## Issues

If you find a bug or want to request a new feature, please open an issue at https://github.com/your-username/franklin-site-status-audit-worker/issues.
