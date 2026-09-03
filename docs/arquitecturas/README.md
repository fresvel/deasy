# Diseños y decisiones de arquitectura

Cada fichero de aquí responde **una** pregunta de diseño y guarda **por qué no se hizo de la otra
forma**. No son planes: los planes, con su control de ejecución, viven en
[`../planes/`](../planes/README.md).

> **Este índice se creó el 2026-09-03**, durante la limpieza del frente 17. El motivo: **tres de
> estos quince documentos no tenían un solo enlace entrante** —`evidencia-de-verificacion.md`,
> `vigilante-de-canales.md` y `roles-permisos-qa-demo.md`— y no porque sobraran, sino porque **no
> había índice del que colgar**. Un documento al que nadie enlaza no está archivado: está perdido.

## El modelo de entregables y plantillas

| | |
|---|---|
| [`modelo-emision-entregables.md`](./modelo-emision-entregables.md) | Los **tres modos** (`single` · `replicated` · `routed`) y por qué el flujo de uno se decide al instanciar |
| [`modelo-templates-entregables-limpio.md`](./modelo-templates-entregables-limpio.md) | Los ejes de la plantilla, ya sin los que murieron |
| [`decisiones-modelo-entregables-2026-06.md`](./decisiones-modelo-entregables-2026-06.md) | La bitácora larga de junio, con las alternativas descartadas |
| [`redisenio-entregables-2026-06.md`](./redisenio-entregables-2026-06.md) | El rediseño por fases que abrió lo anterior |

## Verificación de identidad y canales

| | |
|---|---|
| [`microservicio-channels.md`](./microservicio-channels.md) | Por qué los bots viven **fuera** del backend, y qué contrato tienen |
| [`channels-mas-de-una-intencion.md`](./channels-mas-de-una-intencion.md) | La pregunta *«¿y si el bot hiciera más cosas?»* — y por qué el dueño la cortó |
| [`pestana-de-canales.md`](./pestana-de-canales.md) | Cómo se sabe que un canal está vivo **sin prometer lo que no se puede** |
| [`vigilante-de-canales.md`](./vigilante-de-canales.md) | El centinela que mira aunque nadie tenga la pantalla abierta, y su bitácora de caídas |
| [`limitador-de-intentos.md`](./limitador-de-intentos.md) | Dos métodos, y **por qué unas acciones abren y otras cierran** cuando la base se cae |
| [`evidencia-de-verificacion.md`](./evidencia-de-verificacion.md) | ❌ **El «sello», DESCARTADO.** Se conserva porque se llegó a él discutiendo: sin esto, alguien lo vuelve a proponer |

## Lo legal

| | |
|---|---|
| [`lopdp-y-consentimiento.md`](./lopdp-y-consentimiento.md) | La Ley y su Reglamento **leídos**, artículo por artículo, y qué obliga a cada cosa |
| [`documentos-legales-versionados.md`](./documentos-legales-versionados.md) | Dónde vive el texto aceptado: **dos buckets**, y las cuatro mediciones del bloqueo de objetos |

## Permisos y otros

| | |
|---|---|
| [`roles-permisos-propuesta.md`](./roles-permisos-propuesta.md) | La propuesta de roles |
| [`roles-permisos-qa-demo.md`](./roles-permisos-qa-demo.md) | Los roles de la demo de QA |
| [`app-movil-y-tiempo-real.md`](./app-movil-y-tiempo-real.md) | La app móvil y el tiempo real: **evaluado y aplazado**, con lo que costaría cada opción |
