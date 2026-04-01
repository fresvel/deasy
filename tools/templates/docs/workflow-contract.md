# Contrato de Workflows y Dependencias en Artifacts

Este documento define el contrato técnico mínimo que debe declarar cada artifact en su
`meta.yaml`. El objetivo es que la fuente de verdad del flujo documental nazca en el template y no
en la base de datos. MariaDB puede sincronizar esa información, enriquecerla con política de
negocio o resolver usuarios concretos, pero no debería inventar desde cero la estructura técnica de
llenado y firma.

La idea central es separar dos planos. Por un lado está el plano técnico del artifact: qué formato
usa, qué dependencias requiere, si necesita llenado, si necesita firmas y qué pasos técnicos
declara. Por otro lado está el plano de negocio del proceso: quién llena, quién revisa, quién firma
y cómo se resuelven personas concretas en cada definición de proceso. Este documento solo fija el
plano técnico del artifact.

## Estructura mínima esperada

Todo `meta.yaml` debe incluir, además de su metadata actual, una sección `workflows` y una sección
`dependencies`.

```yaml
key: "investigacion/formativa/informe-docente"
export_id: "tpl_investigacion_formativa_informe_docente"
name: "Informe de Investigación Formativa por Docente"
seed_code: "informe-docente"
seed: "informe-docente"
repository_stage: published
version: 1.0.0
storage_version: v0001
modes:
  system:
    jinja2:
      path: "modes/system/jinja2/src"
  user:
    latex:
      path: "modes/user/latex/src"
origins: []
workflows:
  fill:
    required: true
    source: "artifact"
    sync_mode: "artifact_to_db"
    steps: []
  signatures:
    required: false
    source: "artifact"
    sync_mode: "artifact_to_db"
    steps: []
dependencies:
  templates: []
  data: []
```

## Interpretación de `workflows.fill`

`workflows.fill` no define todavía a la persona exacta que llenará el documento. Lo que define es
que el artifact requiere un flujo de llenado, que esa definición nace en el artifact y que la base
de datos podrá sincronizarla. El arreglo `steps` es el lugar donde luego se podrá declarar una
propuesta técnica más rica: tipos de paso, validaciones, rebotes permitidos, dependencia entre
pasos y capacidades del template.

Si el artifact es del sistema, por ejemplo un template Jinja/LaTeX, esta sección debe existir desde
el repositorio fuente para poder empaquetar y publicar el template. Si el artifact es cargado por un
usuario desde front, esta misma sección debe generarse como parte del borrador antes de subirlo a
MinIO.

## Interpretación de `workflows.signatures`

`workflows.signatures` cumple el mismo rol para la firma. Aquí debe poder expresarse, con el tiempo,
si el artifact se firma por coordenadas, por token, si necesita anchors declarados, si admite una o
varias firmas y si el flujo de firma se debe sincronizar desde el artifact hacia la base.

Al igual que en llenado, esta sección todavía no reemplaza a la política de negocio del proceso.
Solo declara la capacidad y la propuesta técnica del template. La definición de proceso decidirá si
usa ese flujo tal cual, si lo complementa o si lo restringe.

Cuando el template siga un patrón reusable conocido, esta sección también puede declarar
`pattern_ref`. Ese campo no reemplaza todavía a `anchors` ni a `steps` en el sync operativo actual.
Su función inmediata es dejar explícito qué patrón está usando el template y permitir que la CLI
valide que el schema del documento sí declara los campos esperados por ese patrón. Por ahora,
`pattern_ref` es una referencia formal y validable; la materialización operativa sigue viniendo del
`meta.yaml` del template.

## Interpretación de `dependencies`

`dependencies` no significa relaciones entre tablas de MariaDB. Aquí se habla únicamente de
dependencias técnicas del artifact. Por ejemplo, una plantilla puede requerir un template base, un
archivo auxiliar, una semilla previa, un catálogo de datos o algún insumo necesario para su render
o para el flujo técnico de llenado/firma.

Se propone usar dos listas mínimas:

- `dependencies.templates`
  Declara dependencias con otras plantillas o bases técnicas reutilizadas por el artifact.

- `dependencies.data`
  Declara insumos de datos o archivos auxiliares necesarios para preparar, renderizar o validar el
  artifact.

## Diferencia entre artifact del sistema y artifact de usuario

Los artifacts del sistema nacen en `tools/templates/` y se empaquetan con la CLI. Por eso deben
cumplir el contrato antes de llegar a `dist`. Si falta `workflows` o `dependencies`, el empaquetado
debe fallar.

Los artifacts de usuario nacen desde front y se ensamblan en backend como borradores antes de subir
a MinIO. En ese flujo, backend debe escribir el mismo contrato mínimo en `meta.yaml`. Así se evita
que un artifact de usuario entre al sistema sin la información mínima necesaria para sincronizarlo
después con la base.

## Sincronización futura hacia MariaDB

La sincronización recomendada es:

1. el artifact publica `workflows` y `dependencies` en `meta.yaml`
2. el `dist` preserva ese contrato
3. el sincronizador de artifacts lo lee
4. MariaDB crea o actualiza:
   - `fill_flow_templates`
   - `fill_flow_steps`
   - `signature_flow_templates`
   - `signature_flow_steps`
5. la definición del proceso decide cómo convertir esa definición técnica en política operativa

Esto permite que la base de datos siga siendo el centro operativo, pero sin perder que la técnica
del documento vive en el artifact.

## Esquema propuesto para `workflows.fill.steps`

El objetivo de `workflows.fill.steps` es declarar la propuesta técnica del flujo de llenado con un
formato que luego pueda poblar `fill_flow_templates` y `fill_flow_steps` sin inferir nada esencial.
La persona concreta puede resolverse después en el proceso, pero el artifact debe declarar cómo se
espera resolver ese paso.

Se propone esta forma:

```yaml
workflows:
  fill:
    required: true
    source: "artifact"
    sync_mode: "artifact_to_db"
    steps:
      - order: 1
        code: "owner_fill"
        name: "Llenado del responsable"
        resolver:
          type: "document_owner"
          selection_mode: "auto_one"
        required: true
        can_reject: true
      - order: 2
        code: "director_review"
        name: "Revisión de dirección"
        resolver:
          type: "cargo_in_scope"
          cargo_code: "director"
          unit_scope_type: "unit_exact"
          selection_mode: "auto_one"
        required: true
        can_reject: true
```

### Campos propuestos por paso de llenado

Cada paso de llenado debería poder declarar:

- `order`
  Orden secuencial del paso. Debe ser único dentro del flujo.

- `code`
  Identificador estable del paso dentro del artifact. Sirve para sincronización y para evitar
  depender solo de nombres libres.

- `name`
  Etiqueta descriptiva del paso.

- `resolver.type`
  Cómo debe resolverse el actor del paso. Los valores propuestos son:
  - `task_assignee`
  - `document_owner`
  - `specific_person`
  - `position`
  - `cargo_in_scope`
  - `manual_pick`

- `resolver.selection_mode`
  Cómo seleccionar uno o varios actores:
  - `auto_one`
  - `auto_all`
  - `manual`

- `resolver.person_id` o `resolver.person_code`
  Solo para `specific_person`.

- `resolver.position_id` o `resolver.position_code`
  Solo para `position`.

- `resolver.cargo_id` o `resolver.cargo_code`
  Solo para `cargo_in_scope`.

- `resolver.unit_scope_type`
  Ámbito organizacional del paso:
  - `unit_exact`
  - `unit_subtree`
  - `unit_type`
  - `all_units`

- `resolver.unit_id`, `resolver.unit_code`, `resolver.unit_type_id`, `resolver.unit_type_code`
  Referencias opcionales según el scope.

- `required`
  Indica si el paso es obligatorio.

- `can_reject`
  Indica si el actor puede devolver o rebotar el documento.

### Mapeo actual hacia MariaDB

Este contrato se puede mapear casi directo al modelo actual:

- `order` -> `fill_flow_steps.step_order`
- `resolver.type` -> `fill_flow_steps.resolver_type`
- `resolver.selection_mode` -> `fill_flow_steps.selection_mode`
- `resolver.person_id` -> `assigned_person_id`
- `resolver.position_id` -> `position_id`
- `resolver.cargo_id` -> `cargo_id`
- `resolver.unit_scope_type` -> `unit_scope_type`
- `resolver.unit_id` -> `unit_id`
- `resolver.unit_type_id` -> `unit_type_id`
- `required` -> `is_required`
- `can_reject` -> `can_reject`

Los campos `code` y `name` todavía no viven en `fill_flow_steps`. Eso significa que, si queremos
sincronización completa y trazable, conviene agregarlos en la siguiente migración de tablas, pero
el contrato YAML ya debería declararlos desde ahora.

## Esquema propuesto para `workflows.signatures.steps`

La firma tiene una diferencia importante: aquí la política de quién firma y la técnica de dónde se
estampa están mezcladas hoy en el modelo. Para evitar esa confusión, se propone separar ambas
cosas dentro del artifact:

- `workflows.signatures.steps`: quién debe firmar y bajo qué regla técnica mínima
- `workflows.signatures.anchors`: dónde y cómo se coloca la firma

Ejemplo:

```yaml
workflows:
  signatures:
    required: true
    source: "artifact"
    sync_mode: "artifact_to_db"
    pattern_ref: "signatures/three-stage-era"
    anchors:
      - code: "director_signature_anchor"
        placement:
          strategy: "token"
          token: "!-director-signature-!"
        size:
          width: 124
          height: 48
      - code: "secretary_signature_anchor"
        placement:
          strategy: "token"
          token: "!-secretary-signature-!"
        size:
          width: 124
          height: 48
    steps:
      - order: 1
        code: "director_signature"
        name: "Firma del director"
        step_type_code: "electronic"
        required_cargo_code: "director"
        selection_mode: "auto_all"
        required_signers_min: 1
        required_signers_max: 1
        required: true
        anchor_refs:
          - "director_signature_anchor"
      - order: 2
        code: "secretary_signature"
        name: "Firma de secretaría"
        step_type_code: "electronic"
        required_cargo_code: "secretary"
        selection_mode: "auto_all"
        required_signers_min: 1
        required_signers_max: 1
        required: true
        anchor_refs:
          - "secretary_signature_anchor"
```

### Campos propuestos por paso de firma

Cada paso de firma debería poder declarar:

- `order`
- `code`
- `name`
- `step_type_code`
- `required_cargo_code`
- `selection_mode`
- `required_signers_min`
- `required_signers_max`
- `required`
- `anchor_refs`

### Campos propuestos por anchor de firma

Cada anchor debería poder declarar:

- `code`
- `placement.strategy`
  - `token`
  - `coordinates`
  - `artifact_anchor`

- `placement.token`
  Token de búsqueda cuando se firma por marcador.

- `placement.page`
  Página relativa o absoluta si se usa estrategia por coordenadas.

- `placement.x`, `placement.y`
  Coordenadas si aplica.

## Uso recomendado de `pattern_ref`

Cuando varios documentos comparten el mismo patrón de firmas, lo correcto es que el `meta.yaml`
declare esa relación de forma explícita. El valor recomendado de `pattern_ref` es una ruta relativa
dentro de `tools/templates/patterns/`. Por ejemplo:

```yaml
workflows:
  signatures:
    required: true
    source: "artifact"
    sync_mode: "artifact_to_db"
    pattern_ref: "signatures/three-stage-era"
    anchors: [...]
    steps: [...]
```

Ese contrato deja tres garantías. Primero, el template declara qué patrón técnico está usando.
Segundo, la CLI puede validar que el schema sí tiene los campos de firma necesarios. Tercero, el
sync actual sigue funcionando porque `anchors` y `steps` continúan materializados en el propio
`meta.yaml`.

Más adelante, cuando exista una materialización automática de patrones, `pattern_ref` podrá servir
para expandir anchors, fields y pasos sin repetirlos en cada template. Por ahora, se usa como
referencia validable y como puente hacia ese modelo futuro.

- `size.width`, `size.height`
  Tamaño base de la estampa.

## Compatibilidad con las tablas actuales de firma

Aquí está el punto importante: el modelo actual de `signature_flow_steps` solo soporta bien una
parte del contrato propuesto.

Hoy puede mapear:

- `order` -> `step_order`
- `step_type_code` -> `step_type_id`
- `required_cargo_code` -> `required_cargo_id`
- `selection_mode` -> `selection_mode`
- `required_signers_min` -> `required_signers_min`
- `required_signers_max` -> `required_signers_max`
- `required` -> `is_required`

Pero hoy no tiene dónde guardar de forma nativa:

- `code`
- `name`
- `anchor_refs`
- la definición técnica del anchor
- una resolución más rica por unidad o posición, similar a llenado

Por eso, para firma, el YAML puede y debe definirse desde ahora, pero el sincronizador completo
todavía exigirá una refactorización adicional del modelo de firma o la introducción de tablas
técnicas de anchors, como ya se había previsto con `artifact_signature_anchor_versions`.

## Recomendación operativa

La recomendación práctica es:

1. definir desde ya el contrato YAML completo de `fill.steps`, `signatures.steps` y `signatures.anchors`
2. sincronizar primero llenado, porque su tabla actual ya soporta casi todo el modelo propuesto
3. preparar luego la refactorización de firma para no forzar los anchors dentro de una tabla que no
   fue diseñada para eso

Con esto, el artifact sigue siendo la fuente de verdad técnica y la base puede evolucionar sin
romper el contrato publicado por los templates.

## Patrones reusables de firma

Hay un punto importante para la siguiente fase del sistema: muchos documentos no necesitan inventar
su flujo de firmas desde cero. Comparten el mismo patrón técnico y solo cambian los actores
concretos o algunos labels visibles. Por eso conviene formalizar un patrón reusable de firma.

Ese patrón reusable no debe contener personas reales ni tokens concretos. Debe contener la
estructura técnica común:

- slots de firma
- fields lógicos por slot
- anchors por slot
- pasos del workflow
- contrato esperado para el compilador

La referencia propuesta quedó en:

- [three-stage-era.yaml](/home/fresvel/Sharepoint/DIR/Deploy/deasy/tools/templates/patterns/signatures/three-stage-era.yaml)

Ese patrón modela la secuencia común `elaborado -> revisado -> aprobado`. Lo importante es que no
guarda el token real del usuario. Solo declara que, por ejemplo, existe el campo lógico
`signatures.aprobado.token` y que el anchor `firma_aprobado` debe colocarse donde el compilador
renderice ese token en el documento.

## Cómo se conecta el patrón con la base y con el compilador

La relación correcta es esta:

- el patrón reusable define la estructura técnica
- el workflow del template decide qué slots usa
- la política del proceso decide qué firmante ocupa cada slot
- la base de datos resuelve la persona concreta
- el compilador toma el token real desde `persons.token`
- el compilador inyecta ese valor en el campo del documento antes del render
- el signer detecta ese token y aplica la firma en esa posición

Con este enfoque, el template nunca necesita guardar un token “de usuario X”. Lo único que necesita
es declarar el slot, su anchor y el field lógico donde el compilador va a inyectar el token real.

## Qué mantiene este enfoque

Este modelo sí mantiene la idea de un template o patrón de firmas común. No desaparece; solo deja de
estar repetido y se vuelve explícito. Eso permite que varios documentos usen el mismo patrón sin
duplicar manualmente campos, anchors y pasos en cada artifact.

## Normalización de catálogos

Para que la sincronización sea estable, los valores del YAML no deberían depender de textos libres
cuando representan conceptos operativos. La recomendación es normalizar desde ahora un catálogo de
códigos estables y dejar que la base resuelva los identificadores internos.

### Catálogo normalizado para `resolver.type`

Los valores permitidos deberían ser:

- `task_assignee`
- `document_owner`
- `specific_person`
- `position`
- `cargo_in_scope`
- `manual_pick`

Estos códigos ya coinciden con el modelo actual de `fill_flow_steps`, así que conviene conservarlos
sin traducciones intermedias.

### Catálogo normalizado para `resolver.selection_mode`

Los valores permitidos deberían ser:

- `auto_one`
- `auto_all`
- `manual`

Estos valores también coinciden con el modelo actual de llenado.

### Catálogo normalizado para `resolver.unit_scope_type`

Los valores permitidos deberían ser:

- `unit_exact`
- `unit_subtree`
- `unit_type`
- `all_units`

### Catálogo normalizado para `step_type_code` de firmas

Aunque la tabla actual usa `step_type_id`, el artifact no debería depender de IDs numéricos. Se
recomienda normalizar desde ahora un conjunto de códigos de tipo de firma, por ejemplo:

- `electronic`
- `approval`
- `review`
- `seal`

La base o el sincronizador luego resolverán esos códigos contra `signature_types`.

### Catálogo normalizado para `selection_mode` de firmas

Los valores permitidos deberían ser:

- `auto_all`
- `select`
- `auto_quorum`

Estos coinciden con la tabla actual `signature_flow_steps`.

### Catálogo normalizado para `placement.strategy`

Los valores permitidos deberían ser:

- `token`
- `coordinates`
- `artifact_anchor`

Esto permite distinguir entre una firma colocada por token, por coordenadas explícitas o por un
anchor técnico previamente definido en el artifact.

## Relación entre `schema.json`, `data.yaml` y `workflows.fill`

Aquí está la parte clave para el llenado por campos.

`data.yaml` o `data.json` no debería ser la fuente de definición de campos. Esos archivos deben
seguir representando valores de ejemplo, valores por defecto o payload inicial. La definición formal
de los campos que existen, su tipo y su organización debería vivir en `schema.json`.

Dicho de otra forma: `schema.json` responde la pregunta “qué existe y cómo debe entenderlo el
sistema”, mientras que `data.yaml` responde la pregunta “qué valor tiene hoy ese campo en este
documento o en esta semilla”. Mezclar ambas cosas en un solo archivo funciona para pruebas muy
pequeñas, pero a medida que el sistema necesita flujos, permisos por actor, validaciones y una
librería de formularios, esa mezcla se vuelve frágil. Si el valor cambia, no debería cambiar la
definición del campo; y si cambia la definición del campo, eso no debería depender del contenido que
tenga hoy el documento.

Por eso conviene separar responsabilidades desde ahora. El `schema` debe ser estable, versionable y
útil para sincronizar reglas, formularios y permisos. El `data` debe poder variar libremente entre
una instancia y otra del documento sin alterar el contrato técnico del template.

Eso implica esta separación:

- `schema.json`
  define qué campos existen y cómo se organizan

- `data.yaml` / `data.json`
  define valores por defecto, ejemplo o payload inicial del documento

- `meta.yaml`
  define el flujo de llenado y firma, y referencia qué pasos tocan qué campos

Con esa separación, el futuro front puede leer:

1. el esquema de campos desde `schema.json`
2. los permisos o asignación por paso desde `meta.yaml`
3. los valores iniciales desde `data.yaml` o `data.json`

En términos de ejecución, eso significa que el front no tendría que adivinar qué inputs mostrar
desde los valores del payload. En cambio, tomaría el catálogo de campos desde el `schema`, aplicaría
los permisos del workflow y solo después cargaría los datos concretos desde `data`. Esa es la base
correcta para que, más adelante, una librería de componentes de formulario pueda renderizar
distintos tipos de input de forma ordenada y consistente.

## Propuesta para indicar quién llena qué campos

La recomendación es que cada paso de `workflows.fill.steps` no solo declare quién llena, sino
también qué subconjunto de campos gobierna. Para eso se propone agregar `field_refs`.

Ejemplo:

```yaml
workflows:
  fill:
    required: true
    source: "artifact"
    sync_mode: "artifact_to_db"
    steps:
      - order: 1
        code: "owner_fill"
        name: "Llenado del responsable"
        resolver:
          type: "document_owner"
          selection_mode: "auto_one"
        field_refs:
          - "general.periodo"
          - "general.carrera"
          - "reporte.resumen"
          - "reporte.observaciones"
        required: true
        can_reject: true
      - order: 2
        code: "director_review"
        name: "Revision de direccion"
        resolver:
          type: "cargo_in_scope"
          cargo_code: "director"
          unit_scope_type: "unit_exact"
          selection_mode: "auto_one"
        field_refs:
          - "revision.comentarios"
          - "revision.decision"
        required: true
        can_reject: true
```

## Cómo deberían identificarse los campos

Los `field_refs` no deberían depender del label visible del input. Deben apuntar a identificadores
estables. La recomendación es usar una convención por ruta lógica:

- `general.periodo`
- `general.carrera`
- `reporte.resumen`
- `revision.decision`

Si el `schema.json` define estructuras anidadas, el `field_ref` debe seguir esa ruta lógica.

## Propuesta mínima para `schema.json`

Para soportar el llenado por pasos, `schema.json` debería empezar a declarar, además del tipo, una
metadata mínima por campo. No hace falta inventar todavía la librería de front, pero sí conviene
definir un contrato base que luego ella pueda consumir.

Ejemplo:

```json
{
  "type": "object",
  "properties": {
    "general": {
      "type": "object",
      "title": "Datos generales",
      "properties": {
        "periodo": {
          "type": "string",
          "title": "Periodo",
          "x-deasy-field-code": "general.periodo",
          "x-deasy-ui": {
            "component": "text",
            "group": "general"
          }
        },
        "carrera": {
          "type": "string",
          "title": "Carrera",
          "x-deasy-field-code": "general.carrera",
          "x-deasy-ui": {
            "component": "text",
            "group": "general"
          }
        }
      }
    }
  }
}
```

La convención propuesta es:

- `x-deasy-field-code`
  identificador estable del campo para ser referenciado por `field_refs`

- `x-deasy-data-key`
  clave concreta dentro de `data.yaml` o `data.json` cuando el payload todavía usa una estructura
  flat heredada y no una estructura anidada

- `x-deasy-ui.component`
  componente sugerido para el front

- `x-deasy-ui.group`
  agrupación lógica o visual

Esto permite una transición limpia: el workflow ya puede referenciar rutas lógicas como
`signatures.elaborado.nombre`, mientras el payload real sigue usando claves heredadas como
`nombreElaborado`. El front o el sincronizador pueden resolver esa equivalencia por medio de
`x-deasy-data-key` sin romper templates existentes.

## Regla de consistencia entre schema y workflow

Todo `field_ref` declarado en `workflows.fill.steps` debería existir en `schema.json` mediante
`x-deasy-field-code`. Si un paso referencia campos inexistentes, el artifact debería considerarse
inválido en empaquetado o sincronización.

Esto es importante porque evita dos problemas:

- que el workflow asigne campos que el documento no tiene
- que el front tenga que adivinar qué inputs debe bloquear o habilitar por paso

## Recomendación práctica de implementación

La implementación debería seguir este orden:

1. normalizar el catálogo de códigos del YAML
2. empezar a poblar `schema.json` con `x-deasy-field-code` y metadata mínima de UI
3. agregar `field_refs` a `workflows.fill.steps`
4. validar consistencia entre `schema.json` y `meta.yaml`
5. recién después sincronizar eso hacia MariaDB

Así, cuando llegue el momento de construir la librería de formularios del front, ya existirá una
base técnica consistente para renderizar inputs, agruparlos y habilitarlos por actor y por paso.
