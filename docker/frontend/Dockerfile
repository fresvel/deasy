FROM rockylinux/rockylinux:10.1.20251123-ubi

WORKDIR /app

RUN dnf -y install curl --allowerasing && \
  curl -fsSL https://rpm.nodesource.com/setup_22.x | bash - && \
  dnf -y install nodejs && \
  dnf clean all

COPY frontend/package*.json ./frontend/
RUN cd frontend && npm install

COPY frontend ./frontend

WORKDIR /app/frontend
EXPOSE 8080

CMD ["npm", "run", "serve", "--", "--host", "0.0.0.0", "--port", "8080"]
