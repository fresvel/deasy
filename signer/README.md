# Signer — Servicio de Firma Digital

Servicio HTTP que firma documentos PDF usando pyhanko, MinIO y canvas para el estampado.

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
2. Descarga el PDF desde MinIO al directorio temporal
3. Descarga el certificado `.p12` desde MinIO al directorio temporal
4. Escribe la contraseña en un archivo temporal (requerido por pyhanko)
5. Genera la imagen del estampado con QR usando canvas
6. Limpia el PDF con Ghostscript
7. Obtiene coordenadas: directas o buscando el token en el PDF con pdfplumber
8. Inserta el campo de firma con pyhanko
9. Firma el documento con pyhanko usando el certificado `.p12`
10. Sube el documento firmado a MinIO (reemplaza el original)
11. Limpia el directorio temporal
