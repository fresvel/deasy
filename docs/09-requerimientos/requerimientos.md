# Requerimientos

## Procesos pendientes por modulo

1) Docencia: Horarios, Requerimientos Docente, Distributivos.
2) Gestion: Memorandums, Gestion Bibliografica.
3) Academia: Reportes Semestrales, Tutorías, Repositorio de Sílabos.
4) Investigacion: Investigacion, Titulación, Vinculacion 
5) Internacionalización
6) Calidad: Autoevaluación

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
24) Crear un servicio en el que un celular escanne un código QR y envíe su ubicación con alta presición a un servidor 
25) Consideración de diseño de template de procesos: Los procesos documentales son muy variables, siempre están cambiando de plantillas, además en ocasiones se crean procesos nuevos que reemplazan a otros de manera rápida. Una característica general de todos estos es que siempre solicitan documentos, por lo tanto se puede modelar la creación general de estos procesos bajo los siguientes criterios: El proceso tiene dos formas de ejecutarse, de forma manual y de forma sistematizada. En el primer modo el usuario debe utilizar una plantilla word/excel/latex almacenada en el sistema, descargarla, llenarla y subir el documento. La segunda en cambio tendría que mostrar en pantalla los campos y funciones necesarias para generar las consultas en el sistema al punto de crear el documento desde la interacción del usuario con el sistema. Bajo estos criterios, se sugiere tener los siguientes campos en el template almacenado en Mongo: 

mode =  {"system":{"jinja2":"path to jinja2 template"},
         "user":{"latex":"path to latex template",
                 "docx" : "path to docx template",
                 "excel": "path to excel template",
                 "others": {"objects with othes paths maybe not needed"}
         },
        } 
        
De esta manera, cuando se cree un nuevo proceso siempre empezará en modo manual, pidiendo las plantillas al gestor del proceso e incluso esta puede ser una modalidad a través de la cual el equipo de desarrollo conocería nuevas implementaciones a realizar.

26) En las tareas se recomienda establecer una relación proceso-tarea, cada proceso desencadena una tarea main, esta tarea main puede crear tareas hijas que serían las asignaciones que no se han considerado en los procesos. Las tareas main serían las creadas por el sistema a travez de un  puntero directo a un proceso (disparador), mientras que las tareas derivadas serían aquellas hijas de las tareas main que fueron enviadas por el responsable de la tarea main. Estas tareas derivadas son asignaciones que se hacen a los subordinados, deben incluir una descripción y de manera opcional plantillas de documentos. Esta puede ser una ruta para analizar la necesida de implementar nuevos procesos. 

27) Si existen tareas o procesos sin documentos, por ejemplo el registro de horas de vinculación, aunque por detrás debe tener la documentación de respado. Otro sería el registro de calificaciones. Esto solo como referencia.

28) Para tener un control fino de las firmas, se propone que firmas sea una entidad que se comporta de la siguiente manera: una persona puede tener varias firmas, una firma pertenece a un solo usuario, un documento puede tener varias firmas, una firma pertenece a un solo usuario. Las firmas tienen varios tipos, aprobación, revisión, elaboración con posibles padres, y hermanos. También se tendría tipos como enviado, revisado. Aquí se puede podría modelar los tipos a través de relaciones entre firmas o similares. 

29) Regla de control de tareas pendientes al ocupar un puesto: cuando una posición que estaba vacante pasa a estar ocupada, el sistema debe validar si existen tareas pendientes asignadas a ese puesto y, de ser así, completar el snapshot de la asignación con la persona ocupante (actualizar task_assignments.assigned_person_id). Además, notificar al usuario de las tareas pendientes.

## Documentacion pendiente

1) Completar detalle tecnico por entidad (reglas de negocio y validaciones), y mapear endpoints/servicios con ejemplos de uso.
