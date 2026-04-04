# Listado de actividades

Avance del checklist objetivo final: `16/16`

Estado transitorio ya explorado en backend: `5` hitos tecnicos base
Estos hitos existen como prototipo interno y deben extraerse al microservicio compilador antes de cerrar la tarea final.

Buenas practicas base validadas con Context7 (`/expressjs/express/v5.1.0`):
- Definir el contrato HTTP del microservicio sobre rutas explicitas de Express y `express.json()` para el parseo consistente del payload.
- Aprovechar handlers async nativos de Express 5 para propagar errores al middleware central sin wrappers innecesarios.
- Mantener un middleware central de errores para respuestas estructuradas del microservicio.

0. [x] Revisar `Requisitos02.md` para tener el contexto completo de la implementacion y usarlo como base de la hoja de ruta.
1. [x] Definir contrato HTTP del microservicio.
2. [x] Definir contrato de entrada basado en `document_version`.
2.1. [x] Definir la frontera definitiva entre backend principal y microservicio compilador.
2.2. [x] Crear el servicio/contenedor independiente del compilador fuera de `backend/`.
2.3. [x] Crear Dockerfile del compilador basado en `FROM texlive/texlive:<tag>`.
2.4. [x] Integrar lectura de artifact desde storage dentro del microservicio compilador.
2.5. [x] Integrar `DocumentRuntimeService` como proveedor remoto u orquestado de payload hacia el compilador.
2.6. [x] Implementar validador tecnico de template dentro del microservicio compilador.
2.7. [x] Migrar o empaquetar el render Jinja para que no dependa operativamente de rutas locales de `tools/` del backend.
2.8. [x] Implementar pipeline `jinja2 -> latex -> pdf` dentro del microservicio compilador.
2.9. [x] Persistir salida en `working/pdf/`.
2.10. [x] Generar `compile_report.json`.
2.11. [x] Integrar callback o polling con backend principal.
2.12. [x] Conectar transicion documental post-compilacion.
2.13. [x] Agregar observabilidad.
2.14. [x] Agregar tests de contrato y compilacion real.
2.15. [x] Hacer una revision final del contrato tecnico de template compilable para semillas Jinja genericas publicadas en MinIO.

## Prototipo interno ya disponible, pendiente de extraccion

P1. [x] Lectura base de artifact desde storage en backend.
P2. [x] Proveedor de payload basado en `DocumentRuntimeService`.
P3. [x] Validador tecnico de template.
P4. [x] Pipeline base `jinja2 -> latex -> pdf`.
P5. [x] Persistencia base en `working/pdf/`.


# Comentarios para el usuario, ignora esta sección.

Para tener control del desarrollo, se debe seguir la hoja de ruta, cuando se necesite corregir una o varias cosas en un punto, es mejor decirle que cree subtareas indicando la subnumeración.
