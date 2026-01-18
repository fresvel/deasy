FROM rockylinux/rockylinux:10.1.20251123-ubi

WORKDIR /app

RUN dnf -y install dnf-plugins-core && \
  dnf config-manager --set-enabled crb && \
  dnf -y install epel-release && \
  dnf -y install \
  python3 \
  make \
  gcc-c++ \
  pkgconf-pkg-config \
  cairo-devel \
  pango-devel \
  libjpeg-turbo-devel \
  giflib-devel \
  librsvg2-devel \
  && dnf clean all

RUN dnf -y install curl --allowerasing && \
  dnf clean all

RUN curl -fsSL https://rpm.nodesource.com/setup_22.x | bash - && \
  dnf -y install nodejs && \
  dnf clean all

COPY backend/package*.json ./backend/
RUN cd backend && npm install

COPY backend ./backend

# Copiar y configurar el script de entrypoint
COPY docker/backend/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

WORKDIR /app/backend
EXPOSE 3030

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["node", "--watch", "index.js"]
