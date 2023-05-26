FROM node:18

WORKDIR /app

COPY ./server/package*.json ./
RUN npm ci --only=production

COPY ./shared ./shared
COPY ./server .

EXPOSE 8000

CMD [ "npm", "start" ]
