# Evolución de la arquitectura Docker multiambiente

## Objetivo

  Evolucionar la arquitectura Docker actual de `deasy` para que el sistema deje
  de operar como un único stack orientado a desarrollo y pase a una estructura
  formal con tres ambientes separados:

  1. dev,
  2. qa,
  3. prod.

  La evolución debe permitir:

  - mantener una experiencia de desarrollo local cómoda,
  - validar versiones en un ambiente previo a producción,
  - operar producción con mayor aislamiento,
  - preparar el sistema para CI/CD,
  - reducir el acoplamiento entre desarrollo y despliegue.

  ———

## Estado actual

  Hoy existe un único stack Docker basado en `docker/docker-compose.yml` que:

  - levanta múltiples servicios del sistema,
  - está claramente orientado a desarrollo local,
  - monta código fuente local en varios servicios,
  - ejecuta backend en modo desarrollo,
  - ejecuta frontend en modo desarrollo,
  - utiliza un único `.env` para varios servicios.

  Eso implica que, en la práctica, el repositorio hoy tiene un **ambiente dev
  dockerizado**, pero no una arquitectura multiambiente formal.

  ———

## Estado objetivo

  Debe existir una arquitectura Docker separada en tres ambientes:

  - dev
  - qa
  - prod

  Cada ambiente debe tener:

  - configuración propia,
  - persistencia propia,
  - red propia,
  - variables propias,
  - comportamiento adecuado a su propósito.

  La lógica esperada es:

  - dev optimiza velocidad de desarrollo,
  - qa optimiza confianza y validación,
  - prod optimiza estabilidad y operación real.

  ———

## Principios de arquitectura

### 1. Separación entre construcción y ejecución

  Debe separarse claramente:

  - código fuente
  - imagen Docker
  - stack de ejecución
  - ambiente

  Un Dockerfile define cómo construir una imagen.  
  Docker Compose define cómo ejecutar el stack por ambiente.

### 2. Un Dockerfile no debe decidir ambientes

  Los Dockerfiles no deben decidir:

  - ramas,
  - ambientes,
  - política de despliegue.

  Esas diferencias deben resolverse mediante:

  - compose,
  - archivos `.env`,
  - pipeline,
  - configuración de despliegue.

### 3. QA debe parecerse a prod

  El ambiente `qa` no debe comportarse como `dev`.

  Debe ser lo más parecido posible a `prod` en:

  - forma de ejecución,
  - configuración,
  - estabilidad,
  - uso de imágenes cerradas,
  - ausencia de mounts del código local.

### 4. Los ambientes no deben compartir recursos críticos

  No deben compartirse entre ambientes distintos:

  - bases de datos,
  - buckets,
  - colas,
  - topics,
  - secretos,
  - volúmenes persistentes.

### 5. Dev sí puede conservar ergonomía de desarrollo

  El ambiente `dev` puede mantener:

  - bind mounts,
  - hot reload,
  - watch,
  - mayor verbosidad de logs,
  - herramientas de depuración.

  ———

## Requisitos de estructura Docker

### 1. Compose base y compose por ambiente

  Debe existir una estructura con:

  - `compose.base.yml`
  - `compose.dev.yml`
  - `compose.qa.yml`
  - `compose.prod.yml`

  `compose.base.yml` debe contener lo común a todos los ambientes.

  Los compose por ambiente deben definir las diferencias de:

  - puertos,
  - mounts,
  - comandos,
  - variables,
  - reinicio,
  - comportamiento operativo.

### 2. Archivos de entorno por ambiente

  Deben existir archivos separados:

  - `.env.dev`
  - `.env.qa`
  - `.env.prod`

  Cada uno debe contener configuración propia del ambiente.

### 3. Dockerfiles principales neutrales

  Los Dockerfiles principales de servicios deben orientarse a ejecución estable.

  No deben quedar amarrados al modo desarrollo.

### 4. Variantes Dockerfile.dev cuando aplique

  Solo deben existir variantes `Dockerfile.dev` en servicios que realmente
  requieran desarrollo interactivo.

  Ejemplos probables:

  - backend
  - frontend

  Otros servicios deben evaluarse caso por caso.

  ———

## Requisitos por ambiente

### Dev

  El ambiente `dev` debe:

  - permitir bind mounts,
  - permitir hot reload,
  - usar tooling de desarrollo,
  - facilitar depuración,
  - mantener ciclos rápidos de cambio.

### QA

  El ambiente `qa` debe:

  - ejecutarse sin mounts del código local,
  - usar imágenes estables,
  - contar con variables propias,
  - contar con persistencia propia,
  - comportarse de forma cercana a producción,
  - servir para validación previa a prod.

### Prod

  El ambiente `prod` debe:

  - ejecutarse sin mounts del código local,
  - usar imágenes estables,
  - usar reinicio automático cuando corresponda,
  - usar configuración segura,
  - tener recursos propios,
  - estar preparado para observabilidad y operación real.

  ———

## Requisitos específicos por servicio

### Backend

  Debe dejar de estar amarrado al modo desarrollo como definición principal.

  El backend en `qa` y `prod`:

  - no debe usar `watch`,
  - no debe usar `nodemon`,
  - no debe depender de código montado localmente.

  Debe existir una forma estable de ejecución del backend para ambientes no dev.

### Frontend

  El frontend en `qa` y `prod`:

  - no debe ejecutarse con `pnpm run dev`,
  - no debe depender del dev server,
  - debe servirse como build estable.

### Otros servicios

  Servicios como:

  - docs
  - signer
  - analytics

  deben evaluarse individualmente para decidir:

  - si conservan un solo Dockerfile,
  - si requieren `Dockerfile.dev`,
  - si necesitan ajustes especiales por ambiente.

  ———

## Requisitos de persistencia y red

### 1. Persistencia separada

  Cada ambiente debe tener sus propios volúmenes.

  No debe existir reutilización de:

  - volúmenes de base de datos,
  - volúmenes de MinIO,
  - volúmenes de otros servicios persistentes

  entre ambientes distintos.

### 2. Redes separadas

  Cada ambiente debe ejecutarse como proyecto Docker distinto, con su propia red.

### 3. Nombres de proyecto diferenciados

  Debe existir una convención de proyecto Docker por ambiente, por ejemplo:

  - `deasy-dev`
  - `deasy-qa`
  - `deasy-prod`

  ———

## Requisitos de seguridad

### 1. Secretos fuera del repositorio

  Los secretos reales de `prod` no deben guardarse dentro del repositorio.

### 2. Aislamiento de credenciales por ambiente

  Cada ambiente debe poder operar con:

  - credenciales propias,
  - certificados propios,
  - configuración sensible separada.

### 3. No reutilización de recursos sensibles

  No deben compartirse entre ambientes:

  - buckets,
  - credenciales,
  - bases de datos,
  - recursos documentales críticos si generan riesgo operativo.

  ———

## Requisitos de observabilidad y operación

### 1. Healthchecks y readiness

  La arquitectura debe permitir evolucionar hacia:

  - healthchecks,
  - readiness,
  - validaciones de servicio por ambiente.

### 2. Logs y métricas

  Debe quedar preparada la arquitectura para:

  - logs estructurados,
  - monitoreo,
  - métricas,
  - trazabilidad operativa.

### 3. Comandos claros de operación

  Debe existir una forma clara y documentada de:

  - levantar dev,
  - levantar qa,
  - levantar prod,
  - bajar stacks,
  - limpiar volúmenes,
  - levantar servicios parciales.

  ———

## Requisitos de integración con Git y CI/CD

### 1. Alineación con ramas

  Debe existir una convención recomendada:

  - `develop` -> `dev`
  - `release` -> `qa`
  - `main` -> `prod`

### 2. Build por rama

  La arquitectura debe permitir construir imágenes distintas según la rama origen.

### 3. Publicación posterior a registry

  Debe quedar preparada la posibilidad de publicar imágenes a un registry.

### 4. QA y Prod no deben depender de builds manuales locales

  La arquitectura objetivo debe minimizar la necesidad de compilar manualmente
  desde una laptop para `qa` y `prod`.

  ———

## Restricciones

### 1. No romper el flujo actual de desarrollo

  La transición no debe impedir el trabajo local actual del equipo.

### 2. Migración incremental

  La migración debe poder hacerse por etapas.

### 3. Compatibilidad con el stack actual

  La propuesta debe contemplar los servicios actuales del stack, incluyendo:

  - backend
  - frontend
  - docs
  - signer
  - analytics
  - servicios de infraestructura

  ———

## Antipatrones a evitar

  No debe adoptarse como diseño objetivo:

  - un único compose para todos los ambientes sin aislamiento,
  - compartir base de datos entre dev y qa,
  - compartir bucket entre qa y prod,
  - usar `pnpm run dev` o `node --watch` en qa o prod,
  - montar el repositorio local en prod,
  - guardar secretos reales dentro del repositorio,
  - dejar los Dockerfiles principales amarrados al modo desarrollo,
  - promover a prod una versión no validada en un entorno equivalente a qa.

  ———

## Backlog sugerido

  1. Declarar formalmente que el stack actual equivale a `dev`.
  2. Crear `.env.dev`, `.env.qa` y `.env.prod`.
  3. Crear `compose.base.yml`.
  4. Crear `compose.dev.yml`.
  5. Crear `compose.qa.yml`.
  6. Crear `compose.prod.yml`.
  7. Refactorizar Dockerfile del backend a modo estable.
  8. Crear `Dockerfile.dev` del backend si aplica.
  9. Refactorizar Dockerfile del frontend a modo estable.
  10. Crear `Dockerfile.dev` del frontend si aplica.
  11. Evaluar docs, signer, analytics y para definir si requieren
      variantes dev.
  12. Separar volúmenes por ambiente.
  13. Separar nombres de proyecto Docker por ambiente.
  14. Ajustar puertos y redes por ambiente.
  15. Alinear ramas `develop`, `qa` y `main` con ambientes.
  16. Preparar integración con CI/CD.
  17. Endurecer progresivamente operación de `prod`.

  ———

## Criterios de aceptación

  - el stack actual queda formalmente reconocido como `dev`
  - existen definiciones separadas para `dev`, `qa` y `prod`
  - existen `.env.dev`, `.env.qa` y `.env.prod`
  - cada ambiente tiene sus propios volúmenes
  - cada ambiente se ejecuta como proyecto Docker distinto
  - `qa` y `prod` no dependen de mounts del código local
  - backend puede ejecutarse de forma estable fuera de `dev`
  - frontend puede ejecutarse de forma estable fuera de `dev`
  - la estrategia de ramas queda alineada con ambientes
  - la arquitectura queda preparada para CI/CD
  - la transición no rompe el flujo de desarrollo local

  ———

## Resultado esperado

  Al finalizar esta evolución, `deasy` debe contar con una arquitectura Docker
  multiambiente que:

  - mantenga una experiencia de desarrollo cómoda en dev,
  - permita validar releases en qa,
  - permita operar de forma estable en prod,
  - reduzca el acoplamiento entre desarrollo y despliegue,
  - prepare el sistema para automatización y operación más madura.
