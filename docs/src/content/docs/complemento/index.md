---
title: "El complemento: lo que la cadena da por supuesto"
description: "Las 39 tablas que no están en la cadena proceso → documento: quién eres, qué puedes hacer, a quién se contrata, cómo se habla y qué expediente tienes. 38 + 39 = 77, el esquema entero."
sidebar:
  label: "Cómo leer esto"
  order: 0
---

[El modelo, de punta a punta](/modelo/) recorre **una cadena**: de «esta universidad tiene un
proceso» a «este documento existe y lo firmaron estas personas». Son **38 tablas** y se leen en
orden, porque cada eslabón necesita el anterior.

Esta sección es **el resto**: las **39 tablas** que la cadena da por supuestas. No forman una cadena
—son familias independientes que cuelgan casi todas de `persons`— y por eso no se leen en orden: se
entra por la que te interese.

38 + 39 = **77**. Entre las dos secciones está el esquema entero, y eso se puede comprobar, que es
justo la gracia de decirlo.

## Por qué esto no es «lo secundario»

La cadena documental sabe que existe una persona, que ocupa un puesto y que tiene permiso. **No sabe
por qué.** Todo eso lo contesta esta mitad:

- **Quién eres** y cómo se te localiza — el documento con el que entras, tus correos, tus teléfonos.
- **Qué puedes hacer** — el permiso que deja firmar, y el que no.
- **A quién se contrata** — la vacante, la postulación y el contrato que te sientan en el puesto.
- **Cómo se habla** — las conversaciones que cuelgan de un proceso o de una unidad.
- **Qué has hecho antes** — el expediente académico.
- **Que eres tú quien firma** — el certificado, y los códigos que verifican y recuperan.

Quítale cualquiera de ellas a la cadena y deja de funcionar: sin permiso no se firma, sin contrato no
hay ocupante, y sin documento de identidad no hay con quién empezar.

## Las seis familias, y dónde está cada una

Dos de ellas **ya estaban escritas** antes que esta sección, y bien. No se repiten aquí: se enlazan.
Duplicar una cifra garantiza que en dos semanas haya dos versiones distintas de ella.

| Familia | Tablas | Dónde se lee |
|---|:--:|---|
| **Quién eres** — el documento, los correos, los teléfonos, las direcciones y el catálogo geográfico | 10 | [La organización](/modelo/organizacion/#la-persona-ya-no-lo-lleva-todo-encima) |
| **Qué puedes hacer** — recursos × acciones, permisos, roles y los derivados del cargo | 8 | [Autenticación y autorización](/backend/auth/#autorización-rbac) |
| **Que eres tú quien firma** — el certificado y los códigos | 3 | [Credenciales](/complemento/credenciales/) |
| **A quién se contrata** — vacante → postulación → oferta → contrato | 8 | [Empleo y contratación](/complemento/empleo/) |
| **Cómo se habla** — conversaciones, mensajes y avisos | 6 | [La conversación](/complemento/conversacion/) |
| **Qué has hecho antes** — el expediente académico | 2 | [El expediente](/complemento/expediente/) |
| Y dos sueltas: `relation_unit_types` y `signature_batch_jobs` | 2 | [La organización](/modelo/organizacion/) · [Firmas y resto del esquema](/datos/firmas-y-dominios/) |

Todas juntas, sin campos, en el [mapa del complemento](/complemento/mapa-completo/).

## De dónde salen las cifras

Igual que en `/modelo/`: **del catálogo de PostgreSQL en ejecución**, contra una base recién
recreada, no del fichero de esquema y no de otra página.

| | |
|---|---|
| Tablas del complemento | **39** |
| Columnas de esas 39 | **300** |
| Claves foráneas declaradas en ellas | **64** — 37 entre ellas y **27 hacia la cadena** |
| Tablas de la cadena | **38** |
| Tablas del esquema entero | **77** |
| Claves foráneas del esquema entero | **162** |
| Restricciones `CHECK` del esquema entero | **36** |

⚠️ **Contra el fichero no salen.** `grep FOREIGN KEY` sobre `postgres_schema.sql` se deja fuera las
que se declaran con `REFERENCES` en línea. Para una cifra, se consulta la base.

Y una advertencia que ya costó una medición entera: desde `TD7-s` el esquema **describe la forma y no
converge bases anteriores** —no queda ni un `ALTER TABLE`—, así que una pila levantada hace tiempo
conserva la forma vieja **y no avisa**. Antes de medir, se recrea.

:::note[Cómo verificar lo que lees aquí]
El esquema vigente está en `backend/database/postgres_schema.sql`, y el detalle campo a campo, en
[Campos de la cadena](/referencia/campos-proceso-documento/) —que **está generada**, no escrita—.
Estas páginas sí se escriben a mano: si encuentras una discrepancia, gana el esquema.
:::
