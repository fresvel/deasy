# Normalizacion de tareas, artifacts de usuario y flujo documental real

## Objetivo

Definir la siguiente fase de comprobacion e implementacion para llevar el
sistema hacia un modelo operativo mas cercano al flujo real de negocio.

La meta es limpiar la frontera entre:

- instanciacion automatica de tareas derivadas de periodos,
- creacion manual de tareas por usuarios,
- registro de entregables y artifacts de usuario,
- disparo de flujos de llenado y firma,
- y comportamiento esperado de documentos y firmas en la base de datos.

Esta fase debe dejar claro que parte del flujo nace del sistema y que parte
depende de accion explicita del usuario.

## Decision transversal nueva: modelo de artifacts

El sistema deja de tratar los artifacts con la semantica antigua
`system/user` y `system_render/manual_fill` como parte del modelo funcional.

### Nuevo criterio

- El catalogo del artifact queda expresado como:
  - `process`: artifact institucional elegible para procesos.
  - `general`: artifact creado o cargado por usuarios fuera del catalogo de
    proceso.

- El rol del artifact dentro de una definicion queda expresado como:
  - `primary`: documento principal del flujo.
  - `attachment`: adjunto operativo del flujo.
  - `support`: material de apoyo o referencia, no operativo.

### Regla funcional

- La capacidad de renderizar por sistema ya no se modela con un valor manual de
  `usage_role`.
- Esa capacidad se deriva del artifact y de sus formatos disponibles, en
  particular de la presencia de `modes.system.jinja2`.
- Un artifact `general` no debe comportarse como artifact renderizado por
  sistema.

## Problema actual

Hoy el sistema mezcla varias responsabilidades:

- la instanciacion de tareas por periodo se comporta como si todos los
  templates fueran ejecutables por sistema,
- la creacion de artifacts nuevos esta concentrada en admin,
- el dashboard del usuario no modela correctamente la creacion manual de tareas
  ni sus dependencias,
- la vista de tareas asignadas ya muestra mucha informacion operativa pero no
  escala bien en volumen ni en filtros,
- y la base de datos conserva registros documentales y de firma que hacen ruido
  para validar el flujo real.

## Alcance de esta fase

### 1. Regla de instanciacion automatica por periodo

La instanciacion de tareas disparada desde frontend al activar o instanciar un
periodo debe aplicar solo cuando el artifact asociado sea de catalogo
`process`.

### Comprobaciones requeridas

- Verificar como se identifica hoy un artifact de catalogo `process` frente a
  uno `general`.
- Confirmar si para la automatizacion basta `artifact_origin = 'process'` o si
  existe alguna excepcion funcional adicional.
- Confirmar que las tareas automaticas no intenten materializar documentos para
  templates pensados solo para carga o trabajo manual del usuario.

### Decision tecnica cerrada

- Para la automatizacion por periodo, un artifact elegible queda definido como
  `template_artifacts.artifact_origin = 'process'`.
- No se agrega una condicion adicional en esta fase.
- La restriccion se aplica solo al generador automatico por periodo; no al
  pipeline manual.

### Resultado esperado

- Los procesos periodicos solo generan tareas automaticas cuando el artifact es
  de catalogo `process`.
- Los artifacts `general` no deben disparar tareas automaticas desde el flujo
  de periodo.

## 2. Creacion de tareas manuales por usuario comun

El sistema debe incorporar una capacidad real para que un usuario comun cree
 tareas desde el dashboard sin depender del panel admin.

### Decision funcional importante

La tarea manual si puede seguir usando el mismo pipeline de materializacion
documental una vez que ya tiene definido su template o artifact. Es decir:

- crear la tarea manual,
- registrar su artifact o template,
- materializar `task_items`,
- materializar `documents` y `document_versions`,
- y luego disparar flujos de llenado y firma cuando aplique.

La diferencia con la tarea automatica no esta en prohibir
`hydrateTaskFromDefinition()`, sino en controlar:

- quien puede disparar la tarea,
- desde que contexto nace,
- con que artifact se crea,
- y cuando debe materializarse automaticamente.

### Tipos de tarea a soportar

- Tarea general:
  - no depende de un proceso padre,
  - nace completamente por accion del usuario.
- Tarea atada a proceso:
  - nace desde contexto de proceso o derivacion,
  - puede quedar relacionada a una tarea o proceso existente,
  - y debe distinguir entre pertenencia al proceso y derivacion real entre
    tareas.

### Estrategia de relacion entre tareas y procesos

La relacion no debe resolverse usando un solo campo para todo. El modelo ya
tiene dos ejes utiles y deben separarse por responsabilidad:

- `process_run_id`:
  - representa pertenencia operativa a una corrida de proceso,
  - debe ser la relacion principal para tareas automaticas y para tareas
    manuales ligadas a una definicion o corrida existente,
  - permite agrupar, filtrar y auditar tareas dentro del mismo contexto de
    negocio sin fingir una jerarquia artificial entre ellas.

- `parent_task_id`:
  - debe usarse solo cuando una tarea nace como derivacion explicita de otra
    tarea,
  - por ejemplo cuando una tarea madre requiere abrir una subtarea adicional,
  - no debe usarse solo para indicar que una tarea pertenece a un proceso.

### Clasificacion funcional propuesta

- Tarea automatica de proceso:
  - nace por trigger del sistema,
  - pertenece a una `process_run`,
  - no requiere `parent_task_id` salvo derivacion posterior real.

- Tarea manual ligada a proceso:
  - nace por accion de usuario sobre una definicion o corrida habilitada,
  - debe quedar vinculada a `process_run_id`,
  - puede llevar `parent_task_id` solo si el caso funcional es una derivacion
    real desde otra tarea.

- Tarea manual general:
  - nace fuera de una corrida concreta,
  - no requiere `process_run_id`,
  - no requiere `parent_task_id` por defecto,
  - y puede quedar clasificada por tipo u origen manual general.

### Regla de modelado

- Pertenecer a un proceso no implica ser hija de otra tarea.
- Ser derivada de otra tarea no implica crear una corrida nueva.
- El dashboard y la base deben tratar `process_run_id` como contexto y
  `parent_task_id` como jerarquia puntual.

### Requerimientos funcionales

- El dashboard del usuario debe ofrecer una accion real de `Crear tarea`.
- La creacion no debe limitarse a metadata basica; debe cubrir tambien
  entregables, templates y flujos asociados.
- El usuario debe poder registrar artifacts de usuario mediante un flujo de
  modales similar al mecanismo hoy presente en admin para `Nuevo paquete de
  usuario`.
- Los disparadores de estas tareas y dependencias siempre seran usuarios, no
  procesos del sistema.

## 2.1 Gobierno de disparadores de proceso y sus actualizaciones

Ademas del modelado tecnico del trigger, esta fase debe definir quien puede
disparar un proceso y quien puede modificar o actualizar corridas ya creadas.

### Preguntas obligatorias

- Que roles o perfiles pueden lanzar una definicion con trigger manual.
- Que usuarios pueden lanzar una corrida usando un periodo existente.
- Que usuarios pueden lanzar una corrida con periodo custom.
- Quien puede reintentar, reinstanciar, corregir o actualizar una corrida ya
  creada.
- Si el creador de una tarea o corrida puede seguir administrando sus
  dependencias o si esa facultad debe restringirse por rol, unidad o proceso.

### Resultado esperado

- Queda definida una matriz minima de actores y permisos para:
  - disparar procesos,
  - actualizar corridas,
  - crear tareas manuales,
  - adjuntar artifacts de usuario,
  - y reconfigurar dependencias operativas.
- El dashboard no debe mostrar acciones de disparo o actualizacion sin una
  politica explicita de permisos.

### Matriz funcional inicial propuesta

- Sistema:
  - puede disparar corridas automaticas por periodo,
  - solo cuando la definicion tenga trigger `automatic_by_term_type`,
  - y solo cuando los templates que generan tarea pertenezcan a artifacts
    `system`.

- Admin:
  - puede disparar corridas manuales y automaticas con capacidad operativa de
    soporte,
  - puede corregir, reinstanciar o limpiar corridas para mantenimiento,
  - puede intervenir en artifacts de sistema y de usuario segun el flujo
    administrativo.

- Usuario con acceso operativo a la definicion:
  - puede disparar tareas manuales ligadas a proceso cuando la definicion tenga
    `manual_only` o `manual_custom_term`,
  - puede usar periodo existente si la definicion lo permite,
  - puede usar periodo custom solo si existe trigger `manual_custom_term`.

- Usuario creador de una corrida o tarea manual:
  - debe quedar registrado como actor responsable de esa corrida manual,
  - puede seguir completando el flujo guiado de artifact, entregables y
    dependencias antes de que exista evidencia operativa irreversible.

- Usuario operador no creador:
  - puede participar en llenado, firma o carga de entregables si el flujo se lo
    asigna,
  - pero no deberia reconfigurar la corrida ni sus dependencias estructurales
    salvo politica explicita.

### Regla inicial para actualizaciones de corrida

- Antes de que existan entregables materializados con actividad real
  (`fill_requests`, `signature_requests`, `document_signatures` o cargas
  manuales ya consumidas), el creador y admin pueden ajustar dependencias.
- Despues de que exista actividad operativa real, solo admin deberia poder
  aplicar correcciones estructurales, reintentos o limpieza.
- El usuario comun debe poder continuar su trabajo operativo, pero no rehacer la
  definicion estructural del proceso en caliente.

### Politica operativa propuesta para corridas y actualizaciones

- Crear corrida manual:
  - permitido para usuarios con acceso operativo a la definicion cuando exista
    trigger `manual_only` o `manual_custom_term`.

- Crear corrida manual con periodo custom:
  - permitido solo cuando exista trigger `manual_custom_term`.

- Actualizar metadata liviana de una corrida manual propia:
  - permitido al creador mientras la corrida este en fase de configuracion y no
    existan evidencias operativas irreversibles.

- Configurar o cambiar artifact, template, entregables, flujo de llenado o flujo
  de firmas:
  - permitido al creador y a admin solo antes de que el flujo tenga actividad
    real.

- Reinstanciar, reparar o corregir estructura de la corrida:
  - reservado a admin cuando ya existan `documents`, `fill_requests`,
    `signature_requests` o evidencia tecnica asociada.

- Operar llenado, carga documental o firma:
  - permitido a los usuarios asignados por el flujo, sin conceder por eso
    permiso para reconfigurar la corrida completa.

- Limpiar o resetear corridas para pruebas:
  - reservado a admin o scripts operativos controlados.

## 3. Modelado de entregables y artifacts de usuario

Toda tarea creada por usuario debe contemplar entregables desde el inicio.

### Modelo funcional propuesto

- Tarea manual ligada a proceso:
  - nace desde una definicion activa del dashboard,
  - conserva el uso de `hydrateTaskFromDefinition()` para materializar
    entregables documentales,
  - puede usar templates del sistema ya vinculados a la definicion,
  - y debe permitir incorporar artifacts de usuario cuando el caso lo requiera.

- Tarea manual general:
  - nace fuera de una definicion de proceso concreta,
  - requiere un flujo propio para elegir o crear artifact,
  - y luego debe materializar sus entregables documentales con el mismo
    pipeline una vez fijada la configuracion base.

### Requerimientos

- Los entregables de tarea manual deben modelarse usando la ruta de MinIO y el
  flujo de registro hoy asociado a la creacion de paquete de usuario.
- Crear una tarea debe abrir el conjunto de modales necesario para:
  - registrar o seleccionar template/artifact,
  - definir entregables,
  - asociar flujo de llenado cuando aplique,
  - asociar flujo de firmas cuando aplique,
  - y cerrar la tarea con sus dependencias minimas consistentes.
- El dashboard debe comportarse como una experiencia guiada y no como una sola
  forma plana con todos los campos al mismo tiempo.

### Restriccion importante

- No se debe duplicar la logica de admin sin adaptarla al contexto de usuario.
- La experiencia debe reutilizar componentes y clases compartidas del sistema,
  especialmente modales, botones, tags y shells globales.

### Decision de modelado

- El artifact no es un accesorio posterior; es parte del origen del entregable.
- La tarea no deberia considerarse completamente creada hasta que exista al
  menos una configuracion documental coherente:
  - template del sistema reutilizable,
  - artifact de usuario existente,
  - o nuevo paquete de usuario creado en el flujo.
- Despues de fijar esa base, la materializacion de `task_items`, `documents` y
  `document_versions` puede continuar por el pipeline actual.

## 4. Rediseño de la vista de tareas asignadas

La seccion `Tareas asignadas` necesita una estructura que escale mejor con el
crecimiento del volumen documental y de entregables.

### Direccion de UX requerida

- Evolucionar hacia una lista general de paneles o panel list para tareas.
- Incluir filtros funcionales al menos por:
  - año,
  - periodo,
  - tipo de tarea,
  - origen (`automatica` o `manual`),
  - estado,
  - responsable o creador si aporta valor.
- Mantener visibilidad de entregables y pasos activos, pero evitando que toda
  la densidad operativa aparezca expandida por defecto.
- Diseñar una jerarquia visual clara entre:
  - tarea,
  - entregables,
  - estado documental,
  - acciones disponibles,
  - contexto del proceso.

### Criterios de diseño

- Reutilizar el sistema de componentes globales antes de crear patrones nuevos.
- La experiencia debe servir tanto para tareas automaticas como para tareas
  manuales creadas por usuario.
- Debe prepararse para filtros y agrupaciones sin obligar a renderizar toda la
  profundidad del flujo en cada tarjeta.

### Estructura funcional propuesta para la lista

- Barra superior de filtros persistentes:
  - año,
  - periodo,
  - tipo de tarea,
  - origen,
  - estado,
  - definicion o proceso,
  - y filtro rapido `creadas por mi`.

- Lista principal por paneles de tarea:
  - cada panel representa la tarea,
  - muestra resumen compacto de contexto, origen, fechas y progreso documental,
  - y permite expandir o abrir entregables solo bajo demanda.

- Segundo nivel de detalle por entregable:
  - cada entregable se presenta como item secundario dentro del panel,
  - con estado de llenado, estado de firma, version documental y acciones
    disponibles,
  - evitando mostrar todos los botones y tags como ruido visual primario.

- Agrupacion opcional:
  - por año y periodo,
  - o por definicion de proceso cuando el usuario trabaje sobre mucho volumen.

### Regla de lectura visual

- Primero se debe entender la tarea.
- Despues se debe entender el estado operativo de sus entregables.
- Solo al final se deben exponer las acciones finas de documento, llenado,
  firma y chat.

### Propuesta operativa para `Tareas asignadas`

- Filtros primarios visibles:
  - año,
  - periodo,
  - estado,
  - origen (`manual` o `automatica`).

- Filtros secundarios en panel desplegable:
  - tipo de tarea,
  - definicion o proceso,
  - creadas por mi,
  - responsable,
  - con firmas pendientes,
  - con llenado pendiente.

- Orden por defecto:
  - tareas activas primero,
  - dentro de cada bloque por fecha final mas cercana,
  - y luego por fecha de creacion descendente.

- Vista inicial del panel:
  - nombre de la tarea o periodo,
  - tags compactos de tipo, origen y estado,
  - rango de fechas,
  - descripcion breve si existe,
  - resumen numerico de entregables,
  - y una accion principal de expandir o `ver entregables`.

- Vista expandida:
  - lista de entregables asociados,
  - cada entregable en una fila o card compacta,
  - mostrando solo:
    - nombre,
    - estado documental,
    - pendiente de llenado,
    - pendiente de firma,
    - version del documento,
    - y una accion principal segun el siguiente paso del usuario.

- Acciones secundarias:
  - `ver archivo`,
  - `descargar`,
  - `descargar plantilla`,
  - `chat`,
  - `flujo de firmas`,
  - no deben competir visualmente con la accion principal,
  - y deben quedar al final o dentro de un grupo secundario.

- Estado vacio:
  - debe distinguir entre:
    - no tienes tareas,
    - no hay resultados para los filtros actuales.

- Persistencia deseable:
  - mantener filtros y expansion al cambiar entre definiciones del dashboard si
    no contradice el contexto activo.

### Jerarquia visual requerida

- Nivel 1: tarea
  - contexto del proceso,
  - estado general,
  - fechas,
  - quien la creo o responsable general,
  - resumen de carga operativa.

- Nivel 2: entregables
  - solo visibles al expandir,
  - con una linea visual mas limpia que la tarea,
  - priorizando el siguiente paso operativo antes que todos los metadatos.

- Nivel 3: acciones documentales
  - grupo secundario,
  - visualmente mas sobrio,
  - sin repetir botones si la accion principal ya cubre el siguiente paso.

### Regla de reduccion de ruido

- No mostrar todos los botones en todos los entregables por defecto.
- No mostrar simultaneamente tags de progreso, tags de origen y tags de accion
  si no aportan una decision real al usuario.
- El sistema debe poder responder rapidamente estas tres preguntas:
  - que tarea requiere mi atencion,
  - que entregable de esa tarea esta bloqueando,
  - que accion debo ejecutar ahora.

## 4.1 Flujo de modales propuesto para crear tareas

La creacion de tarea desde dashboard debe dejar de ser un modal unico y pasar a
un flujo guiado por pasos.

### Flujo propuesto para tarea ligada a proceso

1. Modal de contexto de tarea
   - descripcion,
   - tipo de lanzamiento,
   - periodo existente o custom segun permisos.

2. Modal de origen documental
   - usar template/paquete del sistema ya vinculado a la definicion,
   - usar artifact de usuario existente,
   - o crear nuevo paquete de usuario.

3. Modal de paquete de usuario
   - reutiliza el contrato del flujo admin actual,
   - pero en experiencia de usuario comun y acotado al contexto de la tarea.

4. Modal de dependencias operativas
   - confirmar si el entregable usa flujo de llenado,
   - confirmar si usa flujo de firmas,
   - mostrar si esas dependencias vienen heredadas desde la definicion o si el
     usuario debe completarlas.

5. Modal de confirmacion
   - resumen de tarea,
   - periodo,
   - artifact seleccionado o creado,
   - entregables que se van a materializar,
   - dependencias activas.

### Flujo propuesto para tarea general

1. Modal de contexto general
   - titulo o descripcion,
   - periodo opcional o contexto temporal,
   - clasificacion de la tarea.

2. Modal de artifact y entregable
   - seleccionar artifact existente del usuario,
   - o crear nuevo paquete de usuario.

3. Modal de dependencias
   - definir si requiere llenado,
   - definir si requiere firma,
   - registrar configuracion minima necesaria.

4. Modal de confirmacion
   - resumen final de la estructura de la tarea.

### Regla de UX

- El usuario no deberia ver todos los campos a la vez.
- Cada modal debe resolver una sola decision principal.
- El dashboard debe conservar progreso entre pasos y permitir volver atras sin
  perder el trabajo ya ingresado.

### Corte implementado en frontend

- En esta fase ya se implemento el flujo guiado de `Crear tarea` para tareas
  manuales ligadas a proceso dentro del dashboard.
- El modal dejo de ser una forma plana y paso a tres pasos:
  - contexto,
  - base documental,
  - confirmacion.
- La base documental mostrada al usuario se apoya en la metadata real de la
  definicion (`templates`, `triggers`, `terms`) sin simular todavia un backend
  de tarea general o de seleccion persistida de artifact.

## 5. Limpieza y lectura correcta de la base de datos

Se requiere una revision de la base de datos para distinguir ruido historico de
datos verdaderamente generados por el flujo de negocio actual.

### Preguntas que esta fase debe responder

- Que tablas documentales y de firma se llenan automaticamente por el flujo del
  sistema.
- Que registros requieren intervencion del usuario.
- En particular, en artifacts `system`, cuando deben aparecer:
  - `documents`,
  - `document_versions`,
  - `signature_flow_instances`,
  - `signature_requests`,
  - `document_signatures`.
- Que datos obsoletos o de pruebas estan distorsionando la validacion del flujo.

### Resultado esperado

- Definir una estrategia de limpieza segura de base.
- Documentar que datos se pueden regenerar por negocio.
- Documentar que datos no deben borrarse porque dependen de accion humana o
  evidencia real.
- Separar claramente limpieza de fixtures, limpieza de historico de pruebas y
  datos funcionales del sistema.

### Hallazgos auditados del flujo documental real

El flujo actual se comporta asi:

- `tasks` y `task_items`:
  - nacen por instanciacion automatica o por creacion manual,
  - y luego entran al pipeline `hydrateTaskFromDefinition()`.

- `documents`:
  - se crean automaticamente en `ensureDocumentsForTask()` para cada
    `task_item`,
  - no requieren intervencion manual para existir.

- `document_versions`:
  - se crean automaticamente con version `0.1` y estado inicial `Borrador`,
  - tampoco requieren intervencion del usuario para existir.

- `document_fill_flows` y `fill_requests`:
  - se crean automaticamente durante `ensureFillFlowForDocumentVersion()`,
  - si existe plantilla de llenado, nacen con pasos y solicitudes `pending`,
  - si no existe plantilla de llenado, el documento salta a `Listo para firma`.

- `signature_flow_instances` y `signature_requests`:
  - no se crean solo por hidratar la tarea,
  - se intentan materializar cuando el documento llega a `Listo para firma`,
  - pero solo nacen si el documento cumple condiciones de firma:
    - artifact `system`,
    - no ser `attachment` ni `support`,
    - tener `working_file_path` PDF,
    - tener plantilla activa de firma,
    - tener pasos definidos,
    - y no tener firmantes requeridos sin resolver.

- `document_signatures`:
  - no son regeneradas por hidratacion ni por transiciones automaticas,
  - nacen solo cuando un usuario registra evidencia real de firma mediante
    `registerSignatureEvidence()`.

### Corte entre datos regenerables y datos con evidencia humana

- Regenerables por negocio:
  - `documents`,
  - `document_versions`,
  - `document_fill_flows`,
  - `fill_requests`,
  - `signature_flow_instances`,
  - `signature_requests`,
  - siempre que no se quiera preservar avance operativo real.

- Con evidencia humana u operativa que no debe asumirse como descartable:
  - `fill_requests` con `responded_at` no nulo o estados distintos de
    `pending`,
  - `signature_requests` con `responded_at` no nulo,
  - `document_signatures`,
  - `document_versions.final_file_path`,
  - y cualquier estado documental derivado de respuestas reales del flujo.

### Estado observado en la base activa el 3 de abril de 2026

- Totales:
  - `documents`: 14
  - `document_versions`: 14
  - `document_fill_flows`: 14
  - `fill_requests`: 42
  - `signature_flow_instances`: 2
  - `signature_requests`: 6
  - `document_signatures`: 1

- Estado de `document_versions`:
  - `Pendiente de llenado`: 10
  - `Pendiente de firma`: 2
  - `En llenado`: 1
  - `Observado`: 1

- Todos los `document_versions` actuales pertenecen a artifacts `system`.

- Los 14 documentos tienen `document_fill_flows`.

- Solo 2 documentos llegaron a firma, lo que confirma que la firma no se
  materializa masivamente al crear tareas, sino despues del llenado.

### Lectura operativa de la base actual

- La base actual no esta contaminada con instancias masivas de firma fuera del
  flujo.
- El ruido principal no viene de firmas huerfanas, sino de historico de
  llenado y de algunos documentos ya tocados en pruebas:
  - un documento observado,
  - uno en llenado,
  - dos pendientes de firma,
  - y uno con una firma registrada.

### Estrategia segura de limpieza para pruebas

- Nivel 1: limpieza blanda para repetir pruebas sin perder estructura
  - enfocarse en documentos ya intervenidos,
  - reiniciar solo evidencia operativa:
    - `document_signatures`,
    - `signature_requests`,
    - `signature_flow_instances`,
    - estados respondidos de `fill_requests`,
    - y estados documentales derivados.

- Nivel 2: regeneracion documental controlada
  - eliminar solo el arbol derivado de tareas de prueba:
    - `document_signatures`,
    - `signature_requests`,
    - `signature_flow_instances`,
    - `fill_requests`,
    - `document_fill_flows`,
    - `document_versions`,
    - `documents`,
  - y volver a hidratar desde las tareas existentes.

- Nivel 3: limpieza total de corrida de prueba
  - eliminar ademas `task_items` y tareas de prueba manuales o automaticas de un
    periodo concreto,
  - y reinstanciar el periodo o corrida.

### Regla de seguridad para limpieza

- Si existe `document_signatures`, no debe borrarse nada sin confirmar que la
  evidencia pertenece a pruebas descartables.
- Si existen `fill_requests` o `signature_requests` respondidas, la limpieza
  debe limitarse a corridas o documentos explicitamente marcados para prueba.
- La limpieza debe apuntar por periodo, corrida o conjunto de tareas; no debe
  ejecutarse como borrado global de tablas activas.

### Ejecucion controlada realizada

El 3 de abril de 2026 se ejecuto una limpieza blanda solo sobre documentos ya
intervenidos en pruebas:

- `document_versions` objetivo:
  - `2`,
  - `9`,
  - `10`,
  - `12`,
  - `14`.

- Acciones ejecutadas:
  - borrado de `document_signatures` asociadas,
  - borrado de `signature_requests` y `signature_flow_instances` asociadas,
  - reset de `fill_requests` a `pending`,
  - reset de `document_fill_flows` a `pending` con `current_step_order = 1`,
  - reset de `documents` y `document_versions` a `Pendiente de llenado`,
  - limpieza de referencias de archivo derivadas de la prueba
    (`working_file_path`, `final_file_path`, `payload_*`, `render_engine`,
    `format`).

### Resultado de la limpieza ejecutada

- Los cinco documentos objetivo quedaron nuevamente en `Pendiente de llenado`.
- Sus `fill_requests` quedaron pendientes y sin respuestas registradas.
- Las tablas globales de firma quedaron en:
  - `signature_flow_instances = 0`
  - `signature_requests = 0`
  - `document_signatures = 0`

## Requerimientos tecnicos

### Backend

- Formalizar la regla de creacion automatica de tareas solo para artifacts con
  `artifact_origin = 'system'`.
- Exponer endpoints o contratos necesarios para:
  - crear tareas manuales,
  - registrar artifacts de usuario,
  - asociar entregables,
  - declarar dependencias de llenado y firma.
- Formalizar permisos y contratos para disparo manual de procesos y para
  actualizacion de corridas o relanzamientos.
- Revisar la orquestacion entre tareas, task_items, documents,
  document_versions y flows para evitar materializaciones indebidas.

### Frontend

- Incorporar en dashboard una UX real para `Crear tarea`.
- Modelar flujos de modales en pasos para creacion de tarea manual.
- Reutilizar los componentes compartidos del proyecto y evitar UI local ad hoc.
- Rediseñar la seccion de tareas asignadas con filtros y estructura escalable.

### Datos

- Auditar el esquema y el contenido actual de tablas documentales y de firma.
- Identificar la minima limpieza necesaria para probar el flujo real.
- Definir si hacen falta scripts de limpieza controlada o consultas operativas
  reproducibles.

## Requisito explicito de Context7

Toda decision que afecte:

- modelado de flujos de usuario en Vue,
- composicion de modal workflows,
- contratos HTTP para creacion de tareas,
- o patrones de ruteo/orquestacion en Express,

debe documentarse con Context7 usando fuentes oficiales cuando la implementacion
dependa del framework o de APIs concretas.

Debe registrarse:

- library ID consultado,
- version objetivo si aplica,
- decision tomada,
- motivo tecnico.

## Backlog sugerido

1. Auditar la logica actual de instanciacion de tareas por periodo y formalizar
   la restriccion a artifacts `system`.
2. Identificar el flujo actual de creacion de paquete de usuario en admin y
   extraer el contrato reutilizable para usuarios comunes.
3. Diseñar el modelo funcional de tarea manual:
   - general,
   - derivada de proceso,
   - entregables requeridos,
   - dependencias de llenado,
   - dependencias de firma.
4. Definir la matriz de actores que pueden disparar procesos manuales y
   actualizar corridas o dependencias operativas.
5. Diseñar y luego implementar el flujo de modales del dashboard para crear
   tareas y registrar sus artifacts.
6. Rediseñar la vista `Tareas asignadas` con filtros y una lista de paneles
   escalable.
7. Auditar la base de datos documental y de firmas para separar datos
   regenerables de datos ruidosos.
8. Definir y ejecutar una estrategia segura de limpieza para pruebas reales.

## Criterios de aceptacion

- Existe una tarea formal `tarea05.md` con checklist ejecutable.
- La regla de instanciacion automatica por periodo queda restringida a
  artifacts `system`.
- Existe una definicion clara de quienes pueden disparar procesos manuales y
  quienes pueden actualizar sus corridas.
- El sistema queda preparado para crear tareas manuales desde dashboard de
  usuario.
- La creacion de tarea contempla entregables y artifacts de usuario mediante
  flujo guiado.
- La vista de tareas asignadas tiene una direccion clara de rediseño escalable.
- La relacion entre flujo de negocio y llenado automatico de tablas
  documentales/firma queda documentada.
- Existe una estrategia concreta para limpiar la base antes de pruebas reales.
