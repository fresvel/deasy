# Requerimientos

## Procesos pendientes por modulo

1) Docencia: Horarios, Requerimientos Docente, Distributivos.
2) Gestion: Memorandums, Gestion Bibliografica.
3) Academia: Reportes Semestrales, Tutorias.
4) Investigacion: Investigacion.
5) Vinculacion: Vinculacion.

## Pendientes generales

0) En añadir procesos la versión debe ser un input similar a Programa, en donde en lugar de Buscar se tendría Editar. Por defecto muestra el valor 0.1, este valor no es editable, pero cuando se da click en el boton Editar, se muesra un modal, en donde se puede modificar solo la vigencia. El campo versión padre, debería establecerse en el modal que aparece cuando se da click en el botón buscar del padre, aquí se debe consultar los procesos y al selecionar un proceso consultar sus versiones y pedir que selecciones una versión de las que estén activas. Si el padre no tiene versiones activas no se permite el registro. Si el padre solo tiene una versión activa, no se pregunta se toma directo esa version.
1) Definir y mantener diagramas entidad-relacion como base para construir y modificar la base de datos.
2) Revisar estructura de base de datos y relaciones; luego desplegar funciones del front segun esa estructura.
3) Busqueda de documentos pendientes por firmar en base de datos, con listado y detalles (titulo, solicitante, fecha, estado).
4) Guardar posiciones de firma por documento y permitir multiples firmas antes de enviar.
5) Solicitar firmas a usuarios con flujo de aprobacion y seguimiento de estado.
6) Configurar multiples secciones de estampado para diferentes usuarios en un mismo documento.
7) Verificar y adoptar recomendaciones sobre manejo de archivos: consistencia BD/storage, backups coordinados, storage compartido, seguridad de rutas, y proceso de limpieza de archivos huerfanos.
8) Definir uso de volumenes persistentes para almacenamiento de archivos en contenedores.
9) Evaluar uso de cola de mensajes (ej. RabbitMQ) para orquestar trabajos de firma y procesos asincronos.
10) Incorporar microservicio de analitica en Python (Pandas) para generar documentos y persistirlos en storage.
11) Implementar RabbitMQ en la arquitectura (si aun no esta configurado).
12) Implementar EMQX para comunicacion en tiempo real (si aun no esta configurado).
13) Definir integracion de microservicios via backend API (sin acceso directo a BD) para mantener reglas y permisos centralizados.
14) Centralizar configuracion de rutas/hosts en backend y frontend (eliminar URLs hardcodeadas, usar env/config).
15) Documentar y mantener estrategia de imagenes base (backend/frontend en Rocky 10.1 UBI; signer/analytics en python:3.11-slim).
16) Crear microservicio de LaTeX con su propio Dockerfile/imagen para compilacion (separado del backend/analytics).
17) Ajustar barra superior de Firmar: alinear selector de paginas con controles superiores y colocar Predefinida + Firmar justo debajo cuando paneles laterales esten activos.
18) Implementar sistema de chat y notificaciones segun docs/01-arquitectura/chat-notificaciones.md.
19) Verificar si el JWT se almacena en cookie, local storage o memoria.
20) Crear las funciones necesarias para editar todo el dosier.
21) Crear reportes basados en el dosier y los usuarios de la base de datos relacional.
22) Crear el rol auditor.
23) Renombrar la sección "personas" a "usuarios" en el resto de vistas/UI pendientes.

## Documentacion pendiente

1) Completar detalle tecnico por entidad (reglas de negocio y validaciones), y mapear endpoints/servicios con ejemplos de uso.
