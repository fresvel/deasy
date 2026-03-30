# Ingeniería de Requerimientos: Planificación e Informes (DEASY)

## 1. Alcance
- Incorporar en DEASY los procesos de Planificación e Informes por carrera/programa, con flujo de aprobación para presentar a las Unidades tipo Escuela.
- Estandarizar plantillas LaTeX y su uso desde un servicio de renderizado/compilación.
- Garantizar versionado, trazabilidad, firmas y relación con periodos académicos (PPO/SPO).

## 2. Acuerdos Funcionales
- Cada **Unidad** puede tener **Procesos propios** sin Programa (ej. Bienestar, Finanzas, Admisiones, TICs).
- Todo **Programa** pertenece a una **Unidad** (ej. Escuela o Facultad), y sus procesos se gestionan dentro de ese Programa.
- Para cada Proceso se gestionan **Planificaciones** e **Informes** por **Año** y **Periodo**.
- Los Informes se basan en Planificaciones actuales; las Planificaciones se nutren de resultados del periodo anterior.
- Las firmas siguen flujo secuencial: **Autor → Revisor → Aprobador**, con notificaciones por MQTT.

## 3. Cambios y Nuevas Creaciones en Arquitectura DEASY
### 3.1 Servicios (backend)
- **Nuevo microservicio de Render** (Python + Jinja2):
  - Recibe JSON + template_id + template_version.
  - Valida payload con JSON Schema.
  - Genera `.tex` y metadata.
- **Nuevo microservicio de Compile** (LaTeX):
  - Recibe ruta al `.tex` y lo compila a PDF.
  - Devuelve ruta final del PDF.
- **Cola de trabajos** (recomendado):
  - Render → Compile; estados: `PENDING`, `RENDERED`, `COMPILED`, `FAILED`.

### 3.2 Modelos de Datos
- **SQL (relaciones y flujo)**:
  - Unidades (jerarquía flexible), Programas, Procesos, Periodos.
  - Documentos (Planificación/Informe) con estado, versión, autores, revisores, aprobadores.
  - Registro de firmas con timestamps.
- **Mongo (contenido editable)**:
  - Payload JSON por versión de documento.
  - Historial de versiones y hash de contenido.

### 3.3 Integración Firmas
- Mantener marcadores en LaTeX para ubicar firmas (`!-era-...-!`).
- Flujo de firma secuencial con notificaciones MQTT.
- La firma no recompila el PDF, solo estampa sobre el PDF generado.

### 3.4 API / Endpoints Nuevos
- CRUD de Documentos (Planificación/Informe): crear, editar payload, versionar.
- Trigger de render/compile y consulta de estado del job.
- Solicitud y confirmación de firma con auditoría.

## 4. Funciones y Dependencias
### Backend
- Python: Jinja2, jsonschema (validación), pydantic (opcional).
- LaTeX: motor de compilación en contenedor o binario.
- Cola: RabbitMQ o Redis.

### Frontend
- Editor de campos de Planificación/Informe (JSON form).
- Vista de dependencias: informes pasados para planificar y planificaciones actuales para informar.
- Panel de firma y estado.

## 5. Flujo General
1. Usuario crea Planificación (payload JSON).
2. Render genera `.tex` y metadata.
3. Compile genera PDF.
4. Firma Autor → Revisor → Aprobador.
5. Documento aprobado se publica en Unidad (Escuela) correspondiente.
6. Informes se generan en base a Planificación vigente.

## 6. Esquema de Directorios Ajustado
### Principios
- Plantillas LaTeX separadas y versionadas.
- Documentos organizados por Unidad → Programa (opcional) → Proceso → Año → Periodo.
- Versionado por `v#` en Planificaciones/Informes.

### Estructura propuesta
```
/DOCUMENTOS
  /PLANTILLAS
    /{template_id}_{slug}/
      /v1/
        template/
        schema.json
      /v2/
        template/
        schema.json

  /UNIDADES
    /{unidad_id}_{unidad_slug}/
      meta.json
      /PROCESOS
        /{proceso_id}_{proceso_slug}/
          /ANIOS/2025/PERIODOS/PPO2025/...
          /ANIOS/2025/PERIODOS/SPO2025/...
      /PROGRAMAS
        /{programa_id}_{programa_slug}/
          meta.json
          /PROCESOS
            /{proceso_id}_{proceso_slug}/
              /ANIOS/2025/PERIODOS/PPO2025/
                /PLANIFICACIONES/v1/{payload.json,latex,PDF}
                /INFORMES/v1/{payload.json,latex,PDF}
              /ANIOS/2025/PERIODOS/SPO2025/
                /PLANIFICACIONES/v1/{payload.json,latex,PDF}
                /INFORMES/v1/{payload.json,latex,PDF}

  /FIRMAS                  # spool temporal de firmas
    /PENDIENTES
    /FIRMADAS

# Nota: los PDF firmados se almacenan en la ruta del Proceso/Versión correspondiente
# Ejemplo:
# .../PROCESOS/{proceso_id}/ANIOS/2025/PERIODOS/{periodo}/INFORMES/v3/PDF/informe_v3_signed.pdf
```


## 6.1 Manejo de Firmas (ancladas a Proceso)
- El PDF firmado debe almacenarse dentro del árbol del **Proceso y Versión** correspondiente.
- La carpeta `/FIRMAS` funciona como **spool temporal** (pendiente/firmado) y no como repositorio final.

### En filesystem
- Ruta final del firmado:
  - `.../PROCESOS/{proceso_id}/ANIOS/2025/PERIODOS/{periodo}/INFORMES/v3/PDF/informe_v3_signed.pdf`
- Spool temporal:
  - `/FIRMAS/PENDIENTES` y `/FIRMAS/FIRMADAS`

### En base de datos (SQL)
- Tabla `document_signatures` con campos mínimos:
  - `process_id`, `document_id`, `document_version`, `period_id`
  - `signed_file_path`, `signed_at`, `signer_user_id`, `signature_status`


### Modelo SQL sugerido (document_signatures)
```
document_signatures
- id (PK)
- document_id (FK)
- process_id (FK)
- period_id (FK)
- document_version (int)
- signer_user_id (FK)
- signature_role (enum: autor, revisor, aprobador)
- signature_status (enum: pendiente, firmado, rechazado)
- signed_file_path (string)
- signed_at (datetime)
- created_at (datetime)
```

## 7. Pendientes
- Definir lista oficial de procesos por Unidad/Programa.
- Definir versiones iniciales de plantillas LaTeX.
- Definir esquemas JSON por tipo de documento.
- Integración MQTT para firmas.
