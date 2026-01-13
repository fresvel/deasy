# C-DEASY (Documentación General)

Este repositorio contiene la aplicación web C-DEASY, orientada a la gestión y digitalización de expedientes docentes, procesos internos universitarios y reportes académicos.

## Estructura del Proyecto

```
/ (raíz del repo)
│
├── backend/           # API RESTful, lógica de negocio y acceso a datos
├── frontend/          # Cliente SPA en Vue.js
├── README.md          # (Este archivo) Documentación técnica principal
```

- Cada subproyecto (`backend`, `frontend`) contiene su propio README con instrucciones detalladas para instalación, despliegue, dependencias y arquitectura específica.
- Todas las rutas, controladores y lógica de APIs se documentan en el README del backend; la composición de vistas, rutas y su estructura modular en el frontend.

## Requisitos Globales
- Node.js >= 18.x
- npm >= 9.x
- Sistema operativo Windows, Linux o macOS

## Instalación Rápida
1. Clonar el repositorio:
   ```
   git clone <url-del-repo>
   ```
2. Instalar dependencias en cada subcarpeta (`frontend` y `backend`):
   ```
   cd backend && npm install
   cd ../frontend && npm install
   ```
3. Configurar los archivos de entorno según las instrucciones de cada proyecto.

## Ejecución/Desarrollo
- Ver guía y comandos de inicio rápido en los README específicos de cada subcarpeta:
   - [README del Backend](./backend/README.md)
   - [README del Frontend](./frontend/README.md)

## Estandarización y Contribución
- El repositorio implementa organización modular estricta, separación entre lógica backend y presentación frontend, y rutas centralizadas.
- Los cambios y nuevas implementaciones deben respetar la estructura y convenciones presentes en cada subproyecto y la documentación técnica provista.

## Otros Recursos
- Para integración continua, despliegue o dudas técnicas, consultar los apartados "Deploy/Gestión" y FAQ en los README de `frontend` y `backend`.
