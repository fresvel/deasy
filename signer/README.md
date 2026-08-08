# Signer — Servicio de Firma Digital

Servicio que firma documentos PDF usando pyhanko, MinIO y canvas para el estampado.

> **El camino real en producción es RabbitMQ, no HTTP.** El backend habla con este servicio por las
> colas `deasy.sign.request` y `deasy.sign.validate.request` y espera la respuesta en la cola que
> él mismo indica en `responseQueue` (ver `backend/services/infrastructure/rabbit_signer.js`). Los
> endpoints HTTP de abajo aceptan el mismo payload y son útiles para depurar, pero **hoy no tienen
> ningún consumidor en el repositorio**.
>
> El mapa completo del microservicio —responsabilidades, contratos que no se pueden romper,
> defectos conocidos y plan de refactor por fases— está en
> [`docs/auditoria-signer-2026-08.md`](../docs/auditoria-signer-2026-08.md).

## Pruebas

```bash
bash scripts/docker-env.sh dev exec -T signer sh -lc 'cd /app && python -m unittest discover -s tests -t . -v'
```

224 casos con `unittest` de la biblioteca estándar (la imagen no trae `pytest`). Ninguno abre red
ni toca MinIO o RabbitMQ reales.

## Endpoints

```
POST /sign
Content-Type: application/json
```

```json
POST /validate
Content-Type: application/json
```

## Payload

```json
{
  "signType": "coordinates",
  "coordinates": { "page": 1, "x": 100, "y": 200 },
  "minioPdfPath": "Firmas/documento.pdf",
  "stampText": "Docente Demo Principal",
  "finalPath": "https://storage.pucese.edu.ec/docs/documento-firmado.pdf",
  "minioCertPath": "Firmas/certificados/mi_cert.p12",
  "certPassword": "mi_contraseña"
}
```

### Campos

| Campo | Tipo | Descripción |
|---|---|---|
| `signType` | `"coordinates"` \| `"token"` | Tipo de ejecución de firma |
| `coordinates` | `{ page, x, y }` | Requerido si `signType = "coordinates"` |
| `token` | `string` | Requerido si `signType = "token"`. Formato: `!-XXXXXXXXXX-!` |
| `minioPdfPath` | `string` | Ruta del PDF en el bucket de spool de MinIO |
| `stampText` | `string` | Nombre completo del firmante para el estampado |
| `finalPath` | `string` | URL pública del documento firmado (se codifica en el QR) |
| `minioCertPath` | `string` | Ruta del certificado `.p12` en MinIO |
| `certPassword` | `string` | Contraseña del certificado |

## Respuesta exitosa

```json
{
  "status": "success",
  "message": "Document signed successfully",
  "signedPath": "Firmas/documento.pdf",
  "finalPath": "https://storage.pucese.edu.ec/docs/documento-firmado.pdf"
}
```

## Respuesta de error

```json
{
  "status": "error",
  "message": "Token marker '!-aB3xKp9mQr-!' not found in PDF"
}
```

## Validación de documentos

### Payload

```json
{
  "minioPdfPath": "users/0105998181/validation/abc/documento.pdf",
  "cedula": "0105998181"
}
```

### Respuesta exitosa

```json
{
  "status": "success",
  "message": "Documento validado correctamente.",
  "summary": {
    "hasSignatures": true,
    "signatureCount": 2,
    "validSignatureCount": 2,
    "matchingCedulaCount": 1,
    "warnings": []
  },
  "signatures": [
    {
      "index": 1,
      "fieldName": "Signature1",
      "valid": true,
      "signerCedula": "0105998181",
      "signerName": "HUGO FERNANDO SINCHI SINCHI",
      "signingTime": "2025-08-13T11:13:30-05:00",
      "certificateAuthority": "SECURITY DATA",
      "certificateIssuedAt": "2024-01-26T22:59:08+00:00",
      "certificateExpiresAt": "2026-01-25T22:59:08+00:00",
      "revocationStatus": "No revocado",
      "extras": {}
    }
  ],
  "matchByCedula": {
    "requestedCedula": "0105998181",
    "found": true,
    "matches": [
      {
        "index": 1,
        "fieldName": "Signature1",
        "signerName": "HUGO FERNANDO SINCHI SINCHI",
        "signerCedula": "0105998181"
      }
    ]
  }
}
```

## Variables de entorno

| Variable | Default | Descripción |
|---|---|---|
| `SIGNER_PORT` | `4000` | Puerto del servicio HTTP |
| `MINIO_ENDPOINT` | `http://minio:9000` | Endpoint de MinIO |
| `MINIO_ACCESS_KEY` | `deasy_minio` | Access key de MinIO |
| `MINIO_SECRET_KEY` | `deasy_minio_secret` | Secret key de MinIO |
| `MINIO_SPOOL_BUCKET` | `deasy-spool` | Bucket de spool en MinIO |
| `SIGN_VALIDATE_REQUEST_QUEUE` | `deasy.sign.validate.request` | Cola RabbitMQ para validación documental |

## Flujo interno

1. Valida el payload JSON
2. Crea un directorio temporal propio del job dentro de `SIGNER_WORKSPACE_DIR`
3. Descarga el PDF y el certificado `.p12` desde MinIO a ese directorio
4. Carga el `.p12` y **rechaza el job si el certificado está expirado o aún no es válido**
5. Normaliza el PDF con Ghostscript, **salvo que ya contenga firmas embebidas** (aplanarlo las
   destruiría)
6. Obtiene coordenadas: directas o buscando el token en el PDF con pdfplumber
7. Genera la imagen del estampado con QR invocando `sigmaker/cli.mjs`
8. Inserta el campo de firma y firma con pyhanko (una vez por cada marca encontrada)
9. Valida la firma resultante; si la cadena no es de confianza, aborta salvo que el payload lo
   tolere (`allow_untrusted_signer`)
10. Sube el documento firmado a MinIO **reemplazando el original**, y además a `finalPath` si es
    distinto
11. El directorio temporal se borra solo al salir del `with`
