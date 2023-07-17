FROM node:18-alpine

ARG backend_api_host
ARG backend_api_port
ARG backend_socket_host
ARG backend_socket_port

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci

COPY . .

# pass the args to Next.js .env.production to be compiled at build
RUN echo "NEXT_PUBLIC_BACKEND_API_HOST=${backend_api_host}" > .env.production &&\
    echo "NEXT_PUBLIC_BACKEND_API_PORT=${backend_api_port}" >> .env.production &&\
    echo "NEXT_PUBLIC_BACKEND_SOCKET_HOST=${backend_socket_host}" >> .env.production &&\
    echo "NEXT_PUBLIC_BACKEND_SOCKET_PORT=${backend_socket_port}" >> .env.production

RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]