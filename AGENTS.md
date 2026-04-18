# AGENTS.md

## Repository rules

### General
- Respetar la estructura, convenciones y organización actual del repositorio.
- Reutilizar componentes, utilidades, servicios y patrones existentes antes de crear nuevos.
- Evitar duplicación de lógica, estilos o estructuras ya resueltas en otro módulo.
- Mantener cambios incrementales, seguros y fáciles de revisar.
- No reescribir módulos completos si no es necesario.
- Priorizar soluciones simples, mantenibles y alineadas con la arquitectura actual del proyecto.
- Si un cambio no es trivial, explicar brevemente la decisión técnica.

## Arquitectura y dominio

### Arquitectura del sistema
- Respetar la separación actual entre frontend, backend, documentación, infraestructura, firma y herramientas auxiliares.
- No mover responsabilidades entre capas sin una razón técnica clara.
- Mantener desacoplamiento entre interfaz, lógica de negocio, servicios, almacenamiento, mensajería y procesos asíncronos.
- Antes de proponer cambios estructurales, identificar el impacto sobre los módulos `frontend/`, `backend/`, `docs/`, `docker/`, `signer/` y `tools/`.

### Límites por capa
- El frontend debe encargarse de presentación, composición de vistas, interacción y validaciones de interfaz.
- El backend debe concentrar reglas de negocio, orquestación, integraciones, persistencia y procesos asíncronos.
- Docker e infraestructura deben describir el entorno y la topología, no absorber lógica funcional del sistema.
- La documentación debe reflejar el comportamiento real del proyecto, no definir la implementación por sí sola.
- Los servicios auxiliares y microservicios deben mantener contratos claros con el backend principal.

### Integración entre módulos
- No acoplar directamente frontend con detalles internos de workers, colas, almacenamiento o servicios auxiliares.
- Toda integración nueva debe respetar los límites de API, contratos de datos y puntos de extensión ya existentes.
- Si un cambio afecta más de un módulo, explicitar el impacto entre capas antes de modificar la implementación.
- Evitar dependencias circulares entre servicios, adaptadores, controladores o procesos auxiliares.

### Consistencia arquitectónica
- Priorizar extensiones sobre reescrituras.
- Reutilizar contratos, servicios, adaptadores y patrones existentes antes de introducir nuevas abstracciones.
- No crear nuevas capas, wrappers o patrones si la arquitectura actual ya resuelve correctamente el caso.
- Si una mejora requiere una nueva abstracción, justificarla por reutilización real, claridad o aislamiento de complejidad.

### Uso de herramientas
- En decisiones de arquitectura backend, integración, infraestructura o microservicios, usar Context7 como apoyo para validar documentación oficial, compatibilidad y patrones técnicos.
- No usar herramientas externas para redefinir la arquitectura del proyecto sin evidencia clara en el código o en las necesidades reales del sistema.
- Priorizar siempre la arquitectura actual del repositorio como fuente principal de verdad.

## Reglas de negocio

### Lógica de negocio
- Mantener la lógica de negocio en backend, servicios, modelos y procesos correspondientes; no desplazarla al frontend.
- No introducir reglas de negocio en componentes visuales, helpers de UI o configuración de infraestructura.
- Si una validación afecta comportamiento funcional del sistema, debe vivir en la capa de dominio o servicio correspondiente.

### Contratos y flujo de datos
- Preservar los contratos existentes entre frontend, backend, servicios auxiliares y procesos de firma.
- No cambiar estructuras de entrada, salida o comportamiento de endpoints sin una justificación clara y sin considerar impacto en consumidores existentes.
- Si se modifica un contrato, actualizar validaciones, documentación y puntos de integración afectados.

### Reglas operativas del sistema
- Respetar el flujo actual de persistencia, mensajería, firma, almacenamiento y procesamiento asíncrono.
- No introducir atajos que rompan trazabilidad, consistencia de datos o separación entre procesamiento síncrono y asíncrono.
- Antes de cambiar un flujo operativo, validar su impacto sobre workers, colas, almacenamiento, firmas y procesos dependientes.

### Evolución funcional
- Las mejoras funcionales deben extender el comportamiento actual antes que reemplazarlo por completo.
- Evitar cambios que alteren reglas de negocio implícitas si no están claramente identificadas y justificadas.
- Si una funcionalidad nueva reutiliza un flujo existente, extender el flujo actual en lugar de duplicarlo.

### Uso de herramientas
- En reglas de negocio, usar primero el código y el comportamiento actual del repositorio como referencia principal.
- Usar Context7 solo como apoyo para validar documentación técnica de dependencias o integraciones relacionadas con la implementación.
- No usar herramientas externas para inferir lógica de negocio que no esté respaldada por el código, contratos o comportamiento existente.

## Frontend rules

### Stack base
- Mantén Vue 3 + Vite + TailwindCSS como stack principal del frontend.
- No introducir frameworks CSS adicionales ni CSS plano nuevo salvo que sea estrictamente necesario.
- Respetar la estructura, aliases, convenciones y organización actual del frontend.

### Arquitectura Vue
- Usar Composition API con `<script setup>`.
- No romper contratos existentes de `props`, `emits`, `slots` ni APIs públicas de componentes.
- Mantener separación clara entre lógica, presentación y composición.
- Reutilizar composables, utilidades y componentes existentes antes de crear nuevos.

### Componentes
- Reutiliza componentes base existentes antes de crear variantes o componentes nuevos.
- Si se crea un componente nuevo, debe seguir los patrones actuales del proyecto en estructura, nombres, props, eventos y estilo.
- Evita duplicación de componentes con diferencias menores.
- No reemplazar componentes compartidos salvo que exista una justificación clara.

### Sistema visual
- Tratar los componentes base actuales del repositorio como fuente principal de verdad visual.
- Mantener consistencia en modales, tablas, formularios, botones, cards, etiquetas y layouts.
- No mezclar patrones visuales incompatibles dentro de una misma vista.

### Tailwind y estilos
- Mantén TailwindCSS como sistema principal de estilos.
- Optimizar clases Tailwind evitando redundancias, conflictos y utilidades innecesarias.
- Mantener consistencia en spacing, tipografía, colores, radios, sombras y estados interactivos.
- Usar utilidades existentes antes de introducir estilos custom.
- Evitar CSS ad hoc si la misma solución puede resolverse con el sistema actual.

### Reglas de reutilización
- Reutilizar componentes globales de `frontend/src/components` antes de crear primitivas locales.
- No crear wrappers sobre componentes globales salvo necesidad funcional clara.
- No duplicar patrones visuales ya resueltos en otra vista.
- Si se necesita un patrón nuevo, generalizarlo como componente reutilizable.

### Bases aprobadas
- Botones: `AppButton.vue`
- Tablas: `AppDataTable.vue`
- Modales: `AppModalShell.vue` y `AppFormModalLayout.vue`
- Tags y estados: `AppTag.vue`
- Tarjetas de navegación: `AppNavCard.vue`
- Carga de archivos: `PdfDropField.vue` y modales compartidos relacionados

### Reglas de estilo compartido
- El comportamiento visual global debe vivir en `frontend/src/styles/tailwind.css`.
- Evitar acumulaciones locales de utilidades Tailwind si el patrón ya es reutilizable o compartido.
- No hardcodear colores, radios, spacing, sombras o tipografía si ya existe una clase o componente compartido.
- Preservar semántica visual consistente para estados success, danger, warning, info, neutral, muted, accent y contrast.
- En vistas de flujo secuencial como llenado y firmas, preservar el patrón actual de tarjetas operativas en grilla:
  - tarjeta blanca con `rounded-[5%]`
  - franja superior de acento por estado
  - bloques internos separados para responsable/firmante y regla
  - uso de color por estado para lectura rápida del avance
- No volver estas tarjetas a listas planas ni cambiar su geometría base salvo que exista una decisión explícita de rediseño.

### Referencias visuales
- Tablas y shells de sección: `perfil`
- Botones y tarjetas de navegación: `admin`
- Menús y drag & drop: `firmas`
- Inputs de texto y password: `login`
- Tags y badges auxiliares: `register`

### Uso de MCPs
- En tareas de refactor UI, priorizar el uso de Tailwind MCP.
- En tareas de validación estructural o refactor de componentes Vue, priorizar el uso de Vue MCP.
- En creación de componentes nuevos, usar Vue MCP y Tailwind MCP como apoyo de análisis y propuesta, manteniendo consistencia con los componentes base existentes del repositorio.
- Usar Context7 solo como apoyo para consultar documentación oficial de Vue, Vite, Tailwind o dependencias relacionadas cuando sea necesario validar sintaxis, APIs o compatibilidad.
- No aplicar sugerencias de Tailwind MCP, Vue MCP o Context7 si contradicen la arquitectura, el estilo o los patrones ya consolidados en el proyecto.

### UX/UI
- Priorizar accesibilidad: contraste, `aria-*`, focus states, navegación por teclado y feedback visual claro.
- Garantizar diseño responsive en todos los cambios.
- Mantener consistencia visual y funcional entre vistas, formularios, tablas, modales y navegación.
- Evitar cambios visuales innecesarios si no aportan valor claro en usabilidad, mantenibilidad o consistencia.

### Validación
- Para cambios de frontend, ejecutar `cd frontend && pnpm run lint` o un lint dirigido sobre los archivos tocados.
- Verificar apariencia y comportamiento, no solo compilación.

## Backend rules

### Stack y estructura
- Mantener Express, ESM y la organización actual en `routes`, `controllers`, `services`, `models`, `workers`, `storage adapters` y `templates`.
- No mover lógica de negocio entre capas sin una razón clara.
- Mantener responsabilidades bien separadas entre rutas, controladores y servicios.

### Implementación
- Reutilizar servicios, helpers y adaptadores existentes antes de crear nuevos.
- No duplicar validaciones, consultas o integraciones si ya existe una implementación equivalente.
- Mantener nombres descriptivos y consistentes con el módulo actual.
- Preservar compatibilidad con endpoints existentes salvo cambio explícitamente solicitado.

### Calidad
- Para cambios backend, validar localmente los endpoints afectados.
- Documentar verificaciones manuales cuando no exista prueba automatizada.
- Si se agregan pruebas, ubicarlas cerca del módulo afectado y seguir el patrón `*.test.js` o `*.spec.js`.

### Uso de herramientas
- En backend, usar Context7 como herramienta principal para consultar documentación oficial de Node.js, Express, librerías, runtimes, colas, almacenamiento, integraciones y configuraciones.
- En tareas de validación de APIs, middlewares, servicios, workers y configuración, consultar primero Context7 antes de proponer cambios estructurales.
- En refactor de controladores, rutas o servicios, apoyarse primero en el código existente del repositorio y usar Context7 solo para validar patrones, compatibilidad y comportamiento esperado.
- No introducir herramientas adicionales para backend si Context7 ya cubre la necesidad documental o técnica.
- No aplicar sugerencias externas si contradicen el comportamiento actual del servicio, la separación de capas o las convenciones del repositorio.

## Docs rules

### Documentación
- Mantener la documentación alineada con el comportamiento real del proyecto.
- No documentar features, flags o flujos que no existan en el código.
- Si cambias comandos, variables de entorno, puertos o pasos de ejecución, actualizar también la documentación afectada.
- Mantener redacción clara, técnica y consistente.

### Uso de herramientas
- En documentación, usar Context7 como herramienta principal para confirmar sintaxis, comandos, configuraciones, APIs y referencias oficiales.
- Antes de documentar cualquier flujo, comando o variable, validar primero contra el código y la configuración real del repositorio.
- No incorporar herramientas adicionales de documentación si Context7 ya cubre la referencia oficial necesaria.
- No documentar features, flags, comandos o ejemplos externos que no existan realmente en el proyecto.
- No aplicar plantillas o sugerencias externas si contradicen la estructura, los flujos o la configuración actual del repositorio.

## Infraestructura y Docker rules

### Docker y servicios
- Respetar la estructura actual de `docker/` y la integración con MariaDB, MongoDB, RabbitMQ, EMQX, MinIO y contenedores de aplicación.
- No cambiar puertos, nombres de servicios, variables o dependencias sin justificación clara.
- Si un cambio requiere ajuste de entorno, documentarlo explícitamente.

### Configuración
- Mantener consistencia con `backend/.env`, `backend/.env_model`, `docker/.env` y variables Vite como `VITE_API_BASE_URL` y `VITE_API_PORT`.
- No introducir nuevas variables de entorno si el problema puede resolverse con la configuración existente.

### Uso de herramientas
- En Docker, infraestructura, variables de entorno, servicios auxiliares y microservicios, usar Context7 como herramienta principal para validar sintaxis, compatibilidad, configuración y documentación oficial.
- Antes de cambiar puertos, redes, servicios, dependencias o variables, validar el impacto sobre la topología actual del proyecto.
- No incorporar herramientas adicionales de infraestructura si Context7 ya cubre la necesidad de referencia técnica.
- Usar la configuración existente del repositorio como fuente principal de verdad y Context7 como apoyo de validación.
- No aplicar sugerencias externas que contradigan la topología, la configuración o los flujos actuales del proyecto.

## Output esperado
- Entregar cambios precisos, legibles, consistentes y mantenibles.
- Minimizar impacto colateral.
- Mantener coherencia entre frontend, backend, docs e infraestructura.

## Recomendación de uso de herramientas
- Mantener un conjunto reducido y equilibrado de herramientas para evitar ruido, latencia y consumo innecesario de créditos.
- En frontend, usar como base Tailwind MCP y Vue MCP.
- En backend, documentación, Docker, infraestructura y microservicios, usar Context7 como herramienta principal.
- Solo incorporar una herramienta adicional cuando cubra una necesidad que Context7 o las herramientas base del frontend no resuelvan.
- Evitar múltiples herramientas solapadas para la misma categoría de trabajo.
- Priorizar siempre el código, la configuración y los patrones del repositorio por encima de sugerencias externas.
