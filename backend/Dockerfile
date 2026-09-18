# Production image for the Church Directory backend (Express + Mongoose).
FROM node:20-alpine

# Used by utils/gitVersion.js to read branch/tag/commit info from the repo's
# .git metadata, which docker-compose bind-mounts read-only at runtime (the
# build context is just this directory, so the image never contains .git).
RUN apk add --no-cache git

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
