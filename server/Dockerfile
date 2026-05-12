FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm config set strict-ssl false && npm ci --include=dev

COPY . .

RUN mkdir -p uploads

EXPOSE 3001

CMD ["node_modules/.bin/ts-node", "src/server.ts"]
