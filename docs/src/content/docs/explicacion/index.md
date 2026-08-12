---
title: "Por dónde empezar a leer"
description: "La guía de lectura: los tres documentos maestros y las tres cosas que más cuestan."
sidebar:
  order: 0
---

**Sobre este documento.** Es una explicación detallada y didactica de la arquitectura del monorepo Deasy, escrita asumiendo cero contexto previo. Recorre el negocio, las ocho piezas que corren en contenedores, el camino completo de una petición HTTP, el backend capa por capa, el modelo de datos y el motor de procesos, el frontend, el microservicio de firma, la infraestructura y el despliegue, la estrategia de pruebas, las trampas conocidas del repositorio y una ruta de lectura sugerida.

Todo lo que se afirma aquí procede de la lectura directa del código: rutas de fichero, nombres de tabla, números de línea y conteos son reales en el momento de escribirlo.

Ruta de lectura sugerida, de menor a mayor dificultad:

| **\#** | **Fichero**                                                  | **Por que**                                                             |
|:-------|:-------------------------------------------------------------|:------------------------------------------------------------------------|
| 1      | `CLAUDE.md`                                                  | Las reglas del proyecto, y es lo mas actualizado                        |
| 2      | `backend/index.js`                                           | El arranque completo en unas 200 líneas                                 |
| 3      | `backend/config/apiPaths.js`                                 | El mapa de URLs de toda la API                                          |
| 4      | `backend/services/documents/DocumentWorkflowResetService.js` | **El estilo objetivo**: una sola responsabilidad, se lee de una sentada |
| 5      | `backend/config/rbacCatalog.js`                              | Entiendes el modelo de permisos entero                                  |
| 6      | `backend/database/postgres_schema.sql`                       | Los comentarios explican el porque de cada decisión                     |
| 7      | `docs/arquitecturas/modelo-emision-entregables.md`           | La fuente de verdad de `item_mode`                                      |
| 8      | `docs/planes/referencia/calidad-y-medicion.md`               | Que esta mal, que se esta arreglando, y **que NO hay que tocar**        |
| 9      | `frontend/src/core/router/index.js`                          | El mapa del frontend                                                    |
| 10     | `signer/app.py`                                              | Dejalo para el final: es denso                                          |

## Los tres documentos maestros

- `docs/planes/referencia/calidad-y-medicion.md` — el **documento maestro** de deuda tecnica y complejidad: mapa de fases con su estado, línea base de SonarQube, ranking de ficheros y funciones, y la lista de **lo que NO hay que tocar** (`sqlTables.js` y los falsos positivos entran ahi). **Leelo antes de proponer un refactor.**

- `docs/planes/referencia/cobertura.md` — la cobertura. Y lo primero que dice: el gate **no pide 80 % global** (eso seria trabajo de años), pide **80 % de lo nuevo**.

- `docs/planes/referencia/patrones-diseno.md` — **cuando usar un patron de diseno y cuando no**. En este repositorio la complejidad se cura con **tablas y extracción**, no con jerarquias; hay tres sitios donde un patron GoF si se gana el sueldo, y una lista de donde seria sobreingenieria.

## Las tres cosas que mas cuestan

Si algo se te atraviesa, casi seguro es una de estas tres:

1.  **El motor de procesos** (serie → regla → flujo, y los tres `item_mode`). Capitulo 5 de este documento.

2.  **El flujo de firma completo**, desde el clic hasta el PDF firmado en MinIO, pasando por la cola. Capitulos 4 y 7.

3.  **El panel de administración genérico** (`sqlTables.js` + `SqlAdminService.js` + `tableHooks.js`, y su contraparte `AdminTableManager.vue`). Capitulos 4 y 6.

------------------------------------------------------------------------

  
Documento generado a partir del análisis directo del repositorio.  
Las cifras (líneas, conteos de tests, tamanos de fichero) son fotos del momento y cambian.
