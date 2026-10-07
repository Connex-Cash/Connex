# node:22-alpine, pinned by digest so a rebuild always starts from the same image.
FROM node:22-alpine@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402
WORKDIR /app
COPY package.json package-lock.json make-key.mjs playbook-admin.mjs ./
COPY src ./src
# Install exactly what the lockfile records, with no install scripts.
RUN npm ci --omit=dev --ignore-scripts --no-fund
USER node
CMD ["node", "src/main.mjs"]
