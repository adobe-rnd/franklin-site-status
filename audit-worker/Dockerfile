FROM --platform=linux/amd64 node:18

WORKDIR /app

COPY ./audit-worker/package*.json ./
RUN npm ci --only=production

COPY ./audit-worker .

CMD [ "npm", "start" ]
