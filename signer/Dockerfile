FROM node:22-slim

# Instalar dependencias del sistema: Python, Ghostscript, poppler, librerías para canvas
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ghostscript \
    poppler-utils \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    && rm -rf /var/lib/apt/lists/*

# Instalar pyhanko y pdfplumber
RUN pip3 install pyhanko pyhanko-cli pdfplumber --break-system-packages

# Crear usuario
RUN useradd --create-home --uid 10001 appuser

WORKDIR /app

# Instalar dependencias Node del servicio principal
COPY package*.json ./
RUN npm install

# Instalar dependencias del sigmaker
COPY sigmaker/package*.json ./sigmaker/
RUN cd sigmaker && npm install

# Copiar el resto del código
COPY . .

# Cambiar a usuario no root
USER appuser

EXPOSE 4000

# Ejecutar index.js dentro de sigmaker
CMD ["node", "index.js"]