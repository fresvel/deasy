---
title: "Qué es Deasy y cómo está montado"
description: "El problema de negocio que resuelve, las ocho piezas en contenedores y el recorrido completo de una petición."
sidebar:
  order: 1
---
## Que es Deasy (el problema de negocio)

Antes de la arquitectura, el **para que**. Deasy es una plataforma de la **PUCE Sede Esmeraldas** para gestionar los **tramites documentales recurrentes** de la universidad: informes de gestion docente, requerimientos, informes de investigación formativa, memorandos, etc.

Hoy, sin Deasy, esos tramites viven en Word y PDF por correo: nadie sabe quien debe entregar que, en que periodo, ni quien falta por firmar. Deasy modela cuatro cosas:

| **Pregunta**        | **Como la modela**                                                                   |
|:--------------------|:-------------------------------------------------------------------------------------|
| ¿Quien?             | Organigrama: unidades → puestos → personas ocupandolos                               |
| ¿Que?               | Plantillas de documento, versionadas                                                 |
| ¿Cuando?            | Periodos academicos (`terms`)                                                        |
| ¿Con que recorrido? | Flujos de *entrega* (quien llena y revisa) y de *firma* (quien firma y en que orden) |

Y encima de todo eso, **firma electronica real** (PAdES, con certificados `.p12` de las autoridades certificadoras ecuatorianas: Security Data, ICERT y Firmasegura).

## Vista de pajaro: ocho piezas en contenedores

Todo el sistema esta **dockerizado**. No hay un “servidor” monolitico, sino ocho procesos que se hablan por red.

```mermaid
%% diagrama 01 — las piezas en contenedores y como se hablan entre ellas
flowchart TD
    NAV["Navegador"]
    NGINX["nginx (proxy)<br/>el portero: TLS + reparto de trafico"]
    FE["frontend<br/>Vue 3"]
    BE["backend<br/>(API REST)<br/>Node 25 + Express 5<br/>+ Socket.IO (tiempo real)"]
    PG["PostgreSQL 17<br/>(los datos)"]
    MINIO["MinIO<br/>(los ficheros)"]
    RABBIT["RabbitMQ<br/>(la cola)"]
    SIGNER["signer<br/>(firma PDFs)<br/>Python + pyHanko<br/>+ helper Node #quot;sigmaker#quot;"]

    NAV -->|"HTTPS"| NGINX
    NGINX -->|"/"| FE
    NGINX -->|"/api/..."| BE
    BE --> PG
    BE --> MINIO
    BE --> RABBIT
    MINIO --> SIGNER
    RABBIT --> SIGNER
```

Traducción de cada pieza para alguien que empieza:

- **nginx**: el “portero” del edificio. Es lo único expuesto a internet. Termina el HTTPS (descifra) y, según la URL, manda la petición al frontend o al backend. También es lo que permite que el frontend llame a `/api/...` sin problemas de CORS.

- **frontend**: la aplicación web (Vue 3). En producción es HTML, JS y CSS estático servido por un nginx pequenito dentro de su propia imagen.

- **backend**: la API. Recibe peticiones HTTP, decide que se puede hacer, guarda en PostgreSQL, sube ficheros a MinIO y encola trabajos de firma en RabbitMQ.

- **PostgreSQL**: la base de datos relacional. **Es el único motor de datos**: MariaDB y MongoDB fueron retirados. Veras comentarios “ex-MongoDB” en el código; son cicatrices de esa migración.

- **MinIO**: almacenamiento de objetos compatible con S3. Los PDFs, plantillas, fotos de perfil y certificados **no** se guardan en la base de datos ni en el disco del backend: van aquí, en *buckets* (contenedores de primer nivel).

- **RabbitMQ**: una cola de mensajes. Sirve para que el backend le pida al signer “firma este PDF” **sin quedarse bloqueado** esperando.

- **signer**: microservicio Python que hace la firma criptografica real.

- **analytics**: hoy es un marcador de posición (`CMD ["sleep","infinity"]`), no hace nada.

:::tip[Por que esa separación importa]

Si la firma se hiciera dentro del backend, un PDF de 200 páginas bloquearia el servidor para todos los usuarios mientras se procesa. Al ponerlo detras de una cola, el backend delega el trabajo pesado y sigue atendiendo peticiones normalmente.

:::

## El recorrido completo de una petición

Esto es lo que mas ayuda a orientarse en un repositorio nuevo. Sigue una petición desde el clic del usuario hasta la respuesta:

```mermaid
%% diagrama 02 — el recorrido completo de una peticion, del navegador al servicio y vuelta
flowchart TD
    P1["1. El navegador pide<br/>https://localhost:8443/api/deasy/v1/users/me<br/>el tramo /api/ es de nginx; /deasy/v1/users/me es del backend"]
    P2["2. nginx (nginx/app-conf.d/default.conf.template):<br/>location /api/ { proxy_pass http://backend:3030/; }<br/>esa barra final BORRA el prefijo /api"]
    P3["3. El backend recibe /deasy/v1/users/me<br/>(el prefijo /deasy/v1 se define en backend/config/apiPaths.js)"]
    P4["4. backend/index.js"]
    P4B["app.use(ROUTES.USERS, user_router)"]
    P5["5. backend/routes/user_router.js"]
    M1["authMiddleware"]
    M2["loadAccessContext"]
    M3["requirePermissions(#quot;account.read#quot;)"]
    M4["controlador"]
    P6["6. backend/controllers/users/user_controler.js"]
    P7["7. backend/services/..."]
    P7B["SQL contra PostgreSQL via getPostgresPool()"]
    P8["8. Vuelta: res.json({...})"]
    R1["nginx"]
    R2["navegador"]

    P1 --> P2
    P2 --> P3
    P3 --> P4
    P4 --> P4B
    P4B --> P5
    P5 --> M1
    M1 --> M2
    M2 --> M3
    M3 --> M4
    M4 --> P6
    P6 -->|"llama a UN servicio"| P7
    P7 --> P7B
    P7B --> P8
    P8 --> R1
    R1 --> R2
```

Ese es el noventa por ciento del sistema. Todo lo demas son variaciones sobre este mismo esqueleto.
