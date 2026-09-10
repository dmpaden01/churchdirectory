# Production image for the Church Directory frontend: builds the Vite/React
# app, then serves the static output with nginx (which also proxies /api to
# the backend container so the browser only ever talks to one origin).

FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
