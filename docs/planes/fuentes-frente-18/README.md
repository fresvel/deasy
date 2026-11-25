# Fuentes del catálogo académico — frente 18

Lo que la tarea `E1` dejó **verificado y listo**. El plan es
[`../expediente-relacional-2026-09.md`](../expediente-relacional-2026-09.md).

## `cine-f-2013-es.csv` — listo para sembrar

**220 filas**, `codigo · nivel · padre · nombre_es · nombre_en`. Cosechado del vocabulario SKOS de la
Oficina de Publicaciones de la UE (`data.europa.eu/snb/isced-f/`), que es una **republicación
literal** del ISCED-F 2013 con las etiquetas oficiales de la UNESCO en 29 idiomas.

⚠️ **Se guarda aquí porque la UNESCO no lo publica en CSV, XLSX ni JSON: sólo en PDF.** Volver a
conseguirlo cuesta cosechar 220 peticiones HTTP.

| Nivel | Códigos | Sustantivos |
|---|---:|---:|
| Campo amplio | 12 | 11 (`00`–`10`) + `99 Campo desconocido` |
| Campo específico | 58 | 29 |
| Campo detallado | 150 | 80 |

**Verificado**: 0 padres inexistentes, y en las 220 filas `padre == codigo[:-1]`. Doblemente
validado contra el PDF de la UNESCO-UIS (mismos conjuntos de códigos) y contra el manual español
(118 de 138 etiquetas literales).

## Lo que NO está aquí, y dónde estaba

Las **carreras y titulaciones del Ecuador** salen del **Anexo II 2023 del RANT** del CES, 101
páginas, **PDF digital y no escaneado** — a diferencia del que se descartó. No se guarda en el
repositorio por tamaño (4,5 MB) y porque su extracción es trabajo de `E2`.

⚠️ **No existe fuente ecuatoriana del catálogo en CSV, XLSX ni JSON.** Se buscó en el CKAN de
`datosabiertos.gob.ec` (0 resultados para «titulaciones» y «campo amplio»), en la oferta vigente del
CES (aplicación PHP sin endpoint) y en la Gaceta (JSF con sesión). La «Base de datos de oferta
académica de las IES» de la SENESCYT sí es legible por máquina (20 045 filas) pero **no es un
catálogo**: sus nombres de carrera son texto libre de cada IES, no lleva código CINE, y su campo
amplio tiene 23 valores porque mezcla CINE-F 2013 con la nomenclatura de 1997.
