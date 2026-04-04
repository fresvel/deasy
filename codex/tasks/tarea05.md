# Listado de actividades

Avance del checklist: `20/25`

Buenas practicas base para esta tarea:
- Usar `Requisitos05.md` como fuente de verdad funcional y tecnica.
- Separar con claridad los flujos disparados por sistema de los flujos
  disparados por usuario.
- Validar toda decision de dashboard contra los componentes globales y clases
  compartidas del frontend antes de introducir patrones nuevos.
- Registrar decisiones de frontend con Context7 `/vuejs/docs` y decisiones de
  backend con Context7 `/expressjs/express/v5.1.0` cuando el cambio dependa de
  APIs o patrones del framework.
- No limpiar datos productivos sin antes documentar si el registro se regenera
  automaticamente por negocio o si depende de intervencion humana.

0. [x] Revisar `Requisitos05.md` y convertir este listado en hoja de ruta operativa.
1. [x] Auditar la instanciacion actual de tareas por periodo desde frontend y backend.
2. [x] Identificar la condicion tecnica exacta para considerar un artifact de catalogo `process` elegible para automatizacion por periodo.
3. [x] Restringir la instanciacion automatica de tareas periodicas solo a artifacts de catalogo `process`.
4. [x] Auditar el flujo actual de `Nuevo paquete de usuario` en admin y extraer el contrato funcional reutilizable.
5. [x] Diseñar el modelo de tarea manual para usuario comun, separando `tarea general` y `tarea atada a proceso`.
6. [x] Definir la matriz de actores que pueden disparar procesos manuales usando periodo existente o periodo custom.
7. [x] Definir quienes pueden actualizar, reinstanciar o corregir corridas de proceso y sus dependencias operativas.
8. [x] Definir como se modelan entregables y artifacts de usuario dentro de la creacion de tarea desde dashboard.
9. [x] Diseñar el flujo de modales requerido para registrar tarea, template/artifact, entregables, flujo de llenado y flujo de firmas.
10. [x] Implementar en dashboard la accion real `Crear tarea` para usuario comun respetando el sistema de componentes compartidos.
11. [x] Definir la estrategia de relacion entre tareas creadas por usuario y procesos existentes: hija, derivada o clasificacion equivalente.
12. [x] Rediseñar la vista `Tareas asignadas` hacia una lista de paneles con filtros por año, periodo, tipo, origen y estado.
13. [x] Ajustar la jerarquia visual de tareas y entregables para reducir ruido operativo sin perder contexto documental.
14. [x] Auditar la base de datos documental y de firmas para distinguir datos regenerables, datos manuales y ruido historico.
15. [x] Documentar como se llenan `documents`, `document_versions`, `signature_flow_instances`, `signature_requests` y `document_signatures` en artifacts de catalogo `process`.
16. [x] Definir y ejecutar una estrategia segura de limpieza de base para pruebas reales del flujo documental y de firmas.
17. [ ] Convertir `Nueva tarea general` en flujo real con backend, artifacts y entregables personalizados.
18. [ ] Revisar la politica de `Iniciar` contrastando la logica actual del dashboard con seeds/templates de llenado para fijar la regla definitiva sin romper el contrato.
19. [ ] Refactorizar la base y contratos para incluir `anio` y fechas de inicio/fin en tareas y entregables cuando corresponda.
20. [ ] Endurecer la politica de versionado para que un artifact publicado que ya disparo tareas quede inmutable y obligue nueva version para cambios de workflow o estructura.
21. [x] Simplificar los workflows de llenado de templates de investigacion formativa y productiva a un solo paso operado por `document_owner`, preservando el flujo de firmas actual.
22. [ ] Realizar una validacion en los casos de que un mismo documento podra ser llenado/firmado por varias personas en un mismo punto (colisiones), modelando adecuadamente si la resolucion es `or` o `and`.
23. [ ] Modelar soporte multiunidad y multifirma para `talento-humano/requerimiento` antes de sincronizar su flujo de firmas, evitando una configuracion enganosa del template.
24. [x] Retirar `execution_mode` del flujo operativo y del admin activo, dejando `trigger_mode` como fuente principal para el inicio del proceso, con migracion local de BD incluida.
25. [x] Refactorizar el modelo de artifacts para separar catalogo (`process` / `general`) de rol operativo (`primary` / `attachment` / `support`), eliminando `system_render` / `manual_fill` del flujo de negocio.

## Context7 Decision Log
- `/vuejs/docs`: se mantuvo el flujo guiado con estado local reactivo en `<script setup>` usando `ref` y `computed`, evitando complejidad adicional para el wizard de `Crear tarea` en un solo componente.
