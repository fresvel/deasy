# derechos_autor.md

Proposito: guia interna para crear, mantener y organizar los elementos del repositorio que son registrables por derechos de autor en Ecuador. Este documento no ejecuta acciones; solo describe el flujo de trabajo.

Alcance de obra (objetos a crear y conservar)
- Documentacion tecnica y funcional (arquitectura, requisitos, dominio de datos, operacion, despliegue).
- Modelos y diagramas (DBML, Draw.io, ER, diagramas de procesos).
- Codigo fuente (backend, frontend, scripts, servicios de reportes y firmas).
- Plantillas y layouts (LaTeX/HTML/JS, firmas y reportes).
- UI/UX (componentes, estilos, layouts, assets propios).

Fuera de alcance (no registrar como obra original)
- Datos reales de la institucion y archivos generados (PDFs, logs, outputs).
- Dependencias externas y librerias de terceros.
- Marcas y nombres comerciales (se registran como marca, no como derecho de autor).

Estructura recomendada (donde guardar cada obra)
- Documentacion: `docs/` (usar indice en `docs/00-indice.md`).
- Modelos: `docs/02-dominio-datos/` y `docs/01-arquitectura/`.
- Backend: `backend/` (servicios, controladores, utilidades, esquema SQL).
- Frontend: `frontend/` (componentes Vue, layouts, estilos, vistas).
- Plantillas: `backend/services/latex/templates/`, `backend/templates/latex/`, `backend/services/webtemplate/`.
- Scripts de soporte: `scripts/`.
- Recursos graficos propios: `frontend/public/images/`, `backend/templates/**/header.png` (solo si son propios).

Reglas para crear obras registrables
1) Todo archivo nuevo debe incluir metadatos minimos (en el encabezado o en un README del modulo):
   - titulo de la obra
   - autores (personas o equipo)
   - fecha de creacion
   - version
2) Mantener la fuente editable:
   - diagramas: conservar el `.drawio`/`.odg` y exportar a PDF/PNG como derivado.
   - plantillas: conservar el `.tex`/`.html`/`.js` como fuente; los PDF generados van a carpeta de salidas.
3) Evitar mezclar material de terceros:
   - si se usa un asset externo, guardar licencia y fuente en `docs/licencias/` (crear si no existe).
4) Separar "fuente" de "salida":
   - `templates/` y `docs/` contienen fuente.
   - `public/`, `temporal/`, `outputs/` contienen salidas y no son registrables.
5) Guardar evidencia de autoria:
   - commits con mensajes claros y referencias a issue/tarea.
   - cambios trazables en documentos (versionado y fechas).

Checklist antes de preparar el registro
- Verificar que el archivo es original y no es copia de terceros.
- Identificar autores y fechas de creacion.
- Consolidar en un paquete por categoria (docs, codigo, templates, UI).
- Excluir datos sensibles, PDFs generados y logs.
- Incluir copia legible (PDF) y fuente editable si el registro lo permite.

Formato sugerido de metadatos (ejemplo)
"""
Titulo: Modulo de firmas y reportes
Autor(es): Equipo Deasy
Fecha: 2026-01-21
Version: 1.0
Descripcion: Motor de generacion y firma de reportes institucionales.
"""

Actualizacion de esta guia
- Cuando se agregue un nuevo tipo de obra registrable, actualizar este archivo.
- Mantener lenguaje claro y sin referencias a datos sensibles.

Inventario inicial (prioridad alta para registro)
- Documentacion tecnica y funcional: `docs/01-arquitectura/*`, `docs/02-dominio-datos/*`, `docs/03-backend/*`, `docs/04-frontend/*`, `docs/05-broker-notificaciones/*`, `docs/06-reportes-firmas/*`, `docs/07-despliegue/*`, `docs/08-operacion/*`, `docs/09-requerimientos/*`, `README.md`
- Modelos y diagramas: `docs/02-dominio-datos/*.drawio`, `docs/02-dominio-datos/mariadb.dbml`, `docs/02-dominio-datos/MER_SQL.sql`, `docs/01-arquitectura/*.drawio`
- Backend (logica propia): `backend/index.js`, `backend/services/**`, `backend/controllers/**`, `backend/routes/**`, `backend/database/mariadb_schema.sql`, `backend/database/mariadb_initializer.js`
- Motor de reportes y firmas: `backend/services/latex/**`, `backend/services/signflow/**`, `backend/services/webtemplate/**`, `docs/06-reportes-firmas/*`
- Frontend (UI/UX y componentes): `frontend/src/components/**`, `frontend/src/layouts/**`, `frontend/src/pages/**`, `frontend/src/views/**`, `frontend/src/scss/**`
- Scripts propios y seeds: `scripts/seed_institucion_real.mjs`, `scripts/reset_mariadb.mjs`, `scripts/validate_design.mjs`, `scripts/seed_university_demo.mjs`

Elementos a excluir o tratar con cautela
- Salidas generadas y logs: `backend/templates/temporal/**`, `backend/public/*.pdf`, `backend/services/signflow/**/Informes*.pdf`, `*.log`, `*.aux`
- Datos reales de la institucion y PDFs academicos (no son obra original)
- Marcas/logos institucionales (van por marca registrada, no copyright)

Proximos pasos recomendados
- Armar un paquete de registro por categoria (docs, codigo, templates, UI) con lista de archivos exacta.
- Preparar inventario formal con autor, fecha y version por elemento.
