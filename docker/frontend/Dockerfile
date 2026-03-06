FROM node:22.12.0-alpine

WORKDIR /app/frontend

RUN npm install -g pnpm@10.17.1

COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY frontend ./

EXPOSE 8080

CMD ["pnpm", "run", "dev"]
