# Arquitectura - Firmas

## Objetivo

Soportar firma de documentos y flujos asociados a procesos academicos, con soporte de multiples firmas y plantillas.

## Flujo de firma (alto nivel)

1) Seleccion y generacion de documento.
2) Definicion de posiciones de firma por usuario.
3) Envio a servicio de firma (signflow/multisigner).
4) Persistencia y versionado en storage compartido.

## Componentes

- Backend: orquesta, valida permisos y registra estado.
- Signflow: firma y manejo de certificados.
- Storage compartido: archivos firmados y originales.

## Integraciones

- Documentos/plantillas enlazados a procesos.
- Ver datos relacionados en docs/02-dominio-datos/mer-signflow.drawio.

## Referencias

- docs/01-arquitectura/firmas.drawio
- docs/06-reportes-firmas/signflow.md

