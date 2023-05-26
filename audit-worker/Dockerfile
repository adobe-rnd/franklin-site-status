FROM node:18

WORKDIR /app

COPY ./audit-worker/package*.json ./
RUN npm ci --only=production

COPY ./shared ./shared
COPY ./audit-worker .

CMD [ "npm", "start" ]
