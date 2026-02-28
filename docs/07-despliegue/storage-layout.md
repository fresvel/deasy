# Storage compartido - layout de documentos

Esta guia define la estructura canonica del filesystem compartido para documentos
generados por procesos, adjuntos de chat, archivos del dosier y spool de firmas. El objetivo es que
los servicios compartan una misma raiz de archivos con rutas estables basadas
en IDs.

## Raices

- Variable: `SHARED_STORAGE_ROOT`
- En MinIO, la estructura se separa por buckets:
  - `deasy-templates` para `Plantillas`
  - `deasy-documents` para `Unidades`
  - `deasy-chat` para `Chat`
  - `deasy-spool` para `Firmas`
  - `deasy-dossier` para `Dosier`

## Estructura principal (IDs primero)

```
/Plantillas
  /{template_id}/
    /v0001/
      template/
      schema.json
    /v0002/
      template/
      schema.json

/Unidades
  /{unidad_id}/
    meta.json
    /PROCESOS
      /{proceso_id}/
        meta.json
        /ANIOS/2025
          /TIPOS_PERIODO
            /{tipo_periodo_id}/
              meta.json
              /PERIODOS
                /{periodo_id}/
                  meta.json
                  /TAREAS
                    /{task_id}/
                      /Documentos
                        /{document_id}/
                          /v0001/
                            payload.json
                            /latex/
                            /pdf/
                            /firmas/
                          /v0002/...

/Chat
  /{conversation_id}/
    /{message_id}/
      archivo.ext

/Firmas
  /PENDIENTES/{document_version_id}/...
  /FIRMADAS/{document_version_id}/...

/Dosier
  /{person_id}/
    /{categoria}/
      /{item_id}/
        archivo.ext
```

## Metadatos recomendados

Los slugs, codigos y nombres legibles viven en `meta.json` (no en la ruta).
Ejemplos:

`/UNIDADES/{unidad_id}/meta.json`
```
{
  "id": 12,
  "slug": "facultad-salud",
  "nombre": "Facultad de Salud"
}
```

`/TIPOS_PERIODO/{tipo_periodo_id}/meta.json`
```
{
  "id": 3,
  "code": "REGULAR",
  "nombre": "Regular"
}
```

`/PERIODOS/{periodo_id}/meta.json`
```
{
  "id": 45,
  "code": "SPO2025",
  "nombre": "Segundo Periodo Ordinario 2025",
  "start": "2025-06-01",
  "end": "2025-10-31"
}
```

## Reglas

- Las rutas usan **IDs** para estabilidad; los slugs se guardan en `meta.json`.
- Las bases de datos guardan **rutas relativas** respecto de la raiz logica de su dominio.
  - Templates: relativas desde `Plantillas/`
  - Documentos: relativas desde `Unidades/`
  - Chat: relativas desde `Chat/`
  - Spool: relativas desde `Firmas/`
  - Dosier: relativas desde `Dosier/`
- Cada documento es versionado como `v0001`, `v0002`, etc.
- `Firmas` es temporal; el resultado final se guarda dentro de
  `/Unidades/.../Documentos/{document_id}/vXXXX/firmas/`.
- Adjuntos de chat se guardan en `/Chat/{conversation_id}/{message_id}/`.
