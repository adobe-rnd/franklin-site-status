FROM node:18

WORKDIR /app

COPY ./import-worker/package*.json ./
RUN npm ci --only=production

COPY ./shared ./shared
COPY ./import-worker .

CMD [ "npm", "start" ]
