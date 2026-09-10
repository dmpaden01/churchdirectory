# Production image for the Church Directory backend (Express + Mongoose).
FROM node:20-alpine

WORKDIR /app

# Install dependencies first so this layer is cached unless package*.json changes.
COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
EXPOSE 5000

CMD ["node", "server.js"]
