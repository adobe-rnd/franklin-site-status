FROM node:18

WORKDIR /app

COPY ./import-worker/package*.json ./
RUN npm ci --only=production

COPY ./import-worker .

CMD [ "npm", "start" ]
