Requerimientos pendientes

1. Definir y mantener diagramas entidad-relacion como base para construir y modificar la base de datos.
2. Revisar estructura de base de datos y relaciones; luego desplegar funciones del front segun esa estructura.
3. Busqueda de documentos pendientes por firmar en base de datos, con listado y detalles (titulo, solicitante, fecha, estado).
4. Guardar posiciones de firma por documento y permitir multiples firmas antes de enviar.
5. Solicitar firmas a usuarios con flujo de aprobacion y seguimiento de estado.
6. Configurar multiples secciones de estampado para diferentes usuarios en un mismo documento.
7. Verificar y adoptar recomendaciones sobre manejo de archivos: consistencia BD/storage, backups coordinados, storage compartido, seguridad de rutas, y proceso de limpieza de archivos huerfanos.
8. Definir uso de volumenes persistentes para almacenamiento de archivos en contenedores.
9. Evaluar uso de cola de mensajes (ej. RabbitMQ) para orquestar trabajos de firma y procesos asincronos.
10. Incorporar microservicio de analitica en Python (Pandas) para generar documentos y persistirlos en storage.
11. Implementar RabbitMQ en la arquitectura (si aun no esta configurado).
12. Implementar EMQX para comunicacion en tiempo real (si aun no esta configurado).
13. Definir integracion de microservicios via backend API (sin acceso directo a BD) para mantener reglas y permisos centralizados.
14. Centralizar configuracion de rutas/hosts en backend y frontend (eliminar URLs hardcodeadas, usar env/config).
15. Documentar y mantener estrategia de imagenes base (backend/frontend en Rocky 10.1 UBI; signer/analytics en python:3.11-slim).
16. Crear microservicio de LaTeX con su propio Dockerfile/imagen para compilacion (separado del backend/analytics).
17. Ajustar barra superior de Firmar: alinear selector de paginas con controles superiores y colocar Predefinida + Firmar justo debajo cuando paneles laterales esten activos.
