FROM --platform=linux/amd64 node:20

WORKDIR /app

COPY ./server/package*.json ./
RUN npm ci --only=production

COPY ./server .

EXPOSE 8000

CMD [ "npm", "start" ]
