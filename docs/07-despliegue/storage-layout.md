# Storage compartido - layout de documentos

Esta guia define la estructura canonica del filesystem compartido para documentos
generados por procesos, adjuntos de chat y spool de firmas. El objetivo es que
los servicios compartan una misma raiz de archivos con rutas estables basadas
en IDs.

## Raiz

- Variable: `SHARED_STORAGE_ROOT`
- Raiz logica: `${SHARED_STORAGE_ROOT}/DOCUMENTOS`

## Estructura principal (IDs primero)

```
/DOCUMENTOS
  /PLANTILLAS
    /{template_id}/
      /v0001/
        template/
        schema.json
      /v0002/
        template/
        schema.json

  /UNIDADES
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
                        /DOCUMENTOS
                          /{document_id}/
                            /v0001/
                              payload.json
                              /latex/
                              /pdf/
                              /firmas/
                            /v0002/...

  /ADJUNTOS
    /CHAT/{conversation_id}/
      /{message_id}/
        archivo.ext

  /SPOOL
    /FIRMAS
      /PENDIENTES/{document_version_id}/...
      /FIRMADAS/{document_version_id}/...
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
- Las bases de datos guardan **rutas relativas** desde `DOCUMENTOS/`.
- Cada documento es versionado como `v0001`, `v0002`, etc.
- `SPOOL/FIRMAS` es temporal; el resultado final se guarda dentro de
  `/UNIDADES/.../DOCUMENTOS/{document_id}/vXXXX/firmas/`.
- Adjuntos de chat se guardan en `/ADJUNTOS/CHAT/{conversation_id}/{message_id}/`.

