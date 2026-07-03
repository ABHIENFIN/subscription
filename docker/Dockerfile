FROM node:20-bookworm-slim

WORKDIR /app

# Prisma needs both OpenSSL 3 (default) and the legacy libssl1.1 for its
# query engine binary on this Prisma version.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
RUN npm ci || npm install

COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src

EXPOSE 3000

CMD ["npm", "run", "dev"]