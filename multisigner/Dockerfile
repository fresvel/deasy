FROM node:22-slim

RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ghostscript \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*

RUN pip3 install pyhanko pdfplumber --break-system-packages

RUN useradd --create-home --uid 10001 appuser

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

USER appuser

CMD ["npm", "start"]