# SvelteKit SSR server (adapter-node) for Cloud Run.
# Serves the CPD server layer (scoring, certificates, checkout, webhook) that
# is dormant in the static Firebase Hosting deploy. Listens on $PORT.
FROM node:20-slim

WORKDIR /app

# Install deps (incl. dev — needed for the vite/SSR build).
# Use `npm install` (not `npm ci`): this repo's local package-lock.json is out of
# sync due to the workspace/hoisting setup on the dev machine, but the clean
# container resolves package.json fresh with no rogue node_modules to poison it.
COPY package.json ./
RUN npm install --no-audit --no-fund

# Build the SSR variant (SSR_BUILD=1 -> adapter-node -> build-ssr/).
COPY . .
RUN SSR_BUILD=1 npm run build

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

# firebase-admin picks up Cloud Run's default service-account credentials
# via applicationDefault(), so auth token verification works in this runtime.
CMD ["node", "build-ssr/index.js"]
