FROM node:18-alpine

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci

COPY . .

RUN npm run build

ARG node_env=production

ENV NODE_ENV ${node_env}

EXPOSE 8998 8999

CMD ["npm", "start"]