FROM node:22-slim

RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ghostscript \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*

RUN pip3 install pyhanko pyhanko-cli pdfplumber --break-system-packages

RUN useradd --create-home --uid 10001 appuser

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Install sigmaker dependencies so QR code generation works
RUN cd sigmaker && npm install

USER appuser

CMD ["npm", "start"]