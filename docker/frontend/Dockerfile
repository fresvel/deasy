FROM rockylinux/rockylinux:10.1.20251123-ubi

WORKDIR /app

RUN dnf -y install curl --allowerasing && \
  curl -fsSL https://rpm.nodesource.com/setup_22.x | bash - && \
  dnf -y install nodejs && \
  npm install -g pnpm && \
  dnf clean all

COPY frontend/package*.json ./frontend/
RUN cd frontend && pnpm install

COPY frontend ./frontend

WORKDIR /app/frontend
EXPOSE 8080

CMD ["pnpm", "run", "dev"]
