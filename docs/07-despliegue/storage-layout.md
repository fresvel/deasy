# Storage - layout logico de objetos

Esta guia define la estructura canonica de prefijos en MinIO para documentos
generados por procesos, adjuntos de chat, archivos del dosier, spool de firmas
y templates. El objetivo es mantener rutas estables basadas en IDs.

## Buckets y raices

- `deasy-templates`
  - `System`
  - `Seeds`
  - `Users`
- `deasy-documents`
  - `Unidades`
- `deasy-chat`
  - `Chat`
- `deasy-spool`
  - `Firmas`
- `deasy-dossier`
  - `Dosier`

## Estructura principal (IDs primero)

```
deasy-templates/System
  /{template_id}/
    /v0001/
      template/
      schema.json
    /v0002/
      template/
      schema.json

deasy-templates/Seeds
  /{seed_type}/
    /{seed_name}/
      /README.md
      /render/
      /src/

deasy-templates/Users
  /{owner_ref}/
    /{template_code}/
      /v0001/
        meta.yaml
        schema.json
        /template/modes/...

deasy-documents/Unidades
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

deasy-chat/Chat
  /{conversation_id}/
    /{message_id}/
      archivo.ext

deasy-spool/Firmas
  /PENDIENTES/{document_version_id}/...
  /FIRMADAS/{document_version_id}/...

deasy-dossier/Dosier
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
  - Templates: relativas desde `System/` o `Users/<cedula>/`
  - Documentos: relativas desde `Unidades/`
  - Chat: relativas desde `Chat/`
  - Spool: relativas desde `Firmas/`
  - Dosier: relativas desde `Dosier/`
- Cada documento es versionado como `v0001`, `v0002`, etc.
- `Firmas` es temporal; el resultado final se guarda dentro de
  `/Unidades/.../Documentos/{document_id}/vXXXX/firmas/`.
- Adjuntos de chat se guardan en `/Chat/{conversation_id}/{message_id}/`.
