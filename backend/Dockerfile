# Production image for the Church Directory backend (Express + Mongoose).
FROM node:20-alpine

WORKDIR /app

# Install dependencies first so this layer is cached unless package*.json/vendor change.
# vendor/ holds local override packages (see package.json "overrides") that npm ci needs
# present at install time.
COPY package*.json ./
COPY vendor ./vendor
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
EXPOSE 5000

CMD ["node", "server.js"]
