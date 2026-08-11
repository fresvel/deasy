> ⚠️ **ARCHIVADO — no es fuente de verdad.**
> Este documento describe el sistema tal como era antes de la reorganizacion de `docs/`.
> Puede citar MariaDB, MongoDB, EMQX/MQTT o rutas que ya no existen. Se conserva por su
> valor historico. Para el estado actual, ver el `README.md` de la raiz.

# Arquitectura - Firmas

## Objetivo

Soportar firma de documentos y flujos asociados a procesos academicos, con soporte de multiples firmas y plantillas.

## Flujo de firma (alto nivel)

1) Seleccion y generacion de documento.
2) Definicion de posiciones de firma por usuario.
3) Envio a servicio de firma (`signer`).
4) Persistencia y versionado en MinIO (`deasy-documents` y `deasy-spool` segun etapa).

## Componentes

- Backend: orquesta, valida permisos y registra estado.
- Signer: firma PDF y manejo operativo de certificados.
- MinIO: archivos originales, spool temporal y firmados.

## Integraciones

- Documentos/plantillas enlazados a procesos.

## Referencias

- docs/01-arquitectura/firmas.drawio
