---
title: "El mapa del complemento, con todos sus campos"
description: "Las 55 tablas del complemento, agrupadas como en el mapa, con todas sus columnas y claves ajenas. Se genera desde el esquema."
sidebar:
  label: "Mapa con campos"
  order: 15.5
---

:::note[Esta página se genera: no se edita a mano]
La escribe `scripts/docs/gen-mapa-campos.mjs` cada vez que corre `bash scripts/docs/gen-dbml.sh`,
a partir del esquema, y la puerta de CI falla si se separa de él. Una edición a mano se pierde en
la siguiente regeneración.

**La agrupación sale de [el mapa del complemento](/complemento/mapa-completo/)**: si una tabla cambia de subgrupo allí,
cambia aquí. **Los campos y las relaciones salen del esquema, sin elegir**: están todos.
:::

**55 tablas · 426 columnas · 81 claves ajenas · 11 diagramas.**

## Cómo leerla

- Cada **caja con campos** es una tabla del grupo, con **todas** sus columnas: tipo, nombre y, si
  lo es, `PK` (clave primaria), `FK` (clave ajena) o `UK` (única).
- **Cada clave ajena se dibuja una sola vez: en el diagrama de la tabla que la guarda.** Si apunta a
  una tabla de otro diagrama, esa tabla sale como **caja vacía**; sus campos están en el suyo.
- Las claves que **llegan** desde otros diagramas se listan debajo de cada uno, en un desplegable.
  Dibujarlas también hacía ilegible cualquier grupo con una tabla a la que apunta medio esquema,
  como `persons`.
- En cada línea, `||` quiere decir que la clave ajena es obligatoria y `|o` que admite nulos; `o{`
  son varias filas y `o|` como mucho una. La etiqueta es la columna que guarda la clave.
- Un subgrupo grande va en varios diagramas seguidos, y algunos se leen de izquierda a derecha:
  se decidió midiendo la letra de cada uno, para que ninguno baje de 12 px a ancho de columna.
- Para acercar, **Ctrl + rueda** sobre el diagrama, o su botón de pantalla completa.

## 1 · Lo que una persona *es*

### Lo que decide el país (1 de 2)

**7 tablas** · 55 columnas · 7 claves ajenas propias.

```mermaid
erDiagram
  %% generado por scripts/docs/gen-mapa-campos.mjs: no se edita a mano
  paises {
    int id PK
    char iso_alpha2 UK
    varchar name
    varchar name_en
    varchar phone_code
    smallint is_active
    timestamp created_at
    timestamp updated_at
  }
  provincias {
    int id PK
    int pais_id FK
    varchar dpa_code
    varchar name
    smallint is_active
    timestamp created_at
    timestamp updated_at
  }
  cantones {
    int id PK
    int provincia_id FK
    varchar dpa_code
    varchar name
    smallint is_active
    timestamp created_at
    timestamp updated_at
  }
  parroquias {
    int id PK
    int canton_id FK
    varchar dpa_code
    varchar name
    int clase_id FK
    smallint is_active
    timestamp created_at
    timestamp updated_at
  }
  clases_parroquia {
    int id PK
    int pais_id FK
    varchar code
    varchar name
    smallint orden
    smallint is_active
    timestamp created_at
    timestamp updated_at
  }
  nomenclatura_territorial {
    int id PK
    int pais_id FK
    smallint nivel
    varchar singular
    varchar plural
    smallint is_active
    timestamp created_at
    timestamp updated_at
  }
  categorias_visa {
    int id PK
    int pais_id FK
    varchar code
    varchar name
    varchar condicion
    smallint orden
    smallint is_active
    timestamp created_at
    timestamp updated_at
  }
  provincias ||--o{ cantones : "provincia_id"
  paises ||--o{ categorias_visa : "pais_id"
  paises ||--o{ clases_parroquia : "pais_id"
  paises ||--o{ nomenclatura_territorial : "pais_id"
  cantones ||--o{ parroquias : "canton_id"
  clases_parroquia |o--o{ parroquias : "clase_id"
  paises ||--o{ provincias : "pais_id"
```

<details>
<summary>Llegan 15 claves ajenas desde otros diagramas</summary>

`autoidentificaciones_etnicas.pais_id` → `paises` · `direcciones.canton_id` → `cantones` · `direcciones.pais_id` → `paises` · `direcciones.provincia_id` → `provincias` · `documentos_identidad.categoria_visa_id` → `categorias_visa` · `documentos_identidad.pais_id` → `paises` · `estados_civiles.pais_id` → `paises` · `generos.pais_id` → `paises` · `instituciones.pais_id` → `paises` · `parentescos.pais_id` → `paises` · `persons.nacimiento_canton_id` → `cantones` · `persons.nacimiento_pais_id` → `paises` · `persons.nacionalidad_pais_id` → `paises` · `telefonos.pais_id` → `paises` · `tipos_discapacidad.pais_id` → `paises`

</details>

### Lo que decide el país (2 de 2)

**6 tablas** · 47 columnas · 6 claves ajenas propias. Apunta a `paises`, que sale como caja vacía.

```mermaid
erDiagram
  %% generado por scripts/docs/gen-mapa-campos.mjs: no se edita a mano
  direction LR
  instituciones {
    int id PK
    varchar nombre
    int pais_id FK
    text campo_sexo_genero
    smallint is_active
    timestamp created_at
    timestamp updated_at
  }
  generos {
    int id PK
    int pais_id FK
    varchar code
    varchar name
    smallint orden
    smallint is_active
    timestamp created_at
    timestamp updated_at
  }
  estados_civiles {
    int id PK
    int pais_id FK
    varchar code
    varchar name
    smallint orden
    smallint is_active
    timestamp created_at
    timestamp updated_at
  }
  autoidentificaciones_etnicas {
    int id PK
    int pais_id FK
    varchar code
    varchar name
    smallint orden
    smallint is_active
    timestamp created_at
    timestamp updated_at
  }
  tipos_discapacidad {
    int id PK
    int pais_id FK
    varchar code
    varchar name
    smallint orden
    smallint is_active
    timestamp created_at
    timestamp updated_at
  }
  parentescos {
    int id PK
    int pais_id FK
    varchar code
    varchar name
    smallint orden
    smallint is_active
    timestamp created_at
    timestamp updated_at
  }
  paises ||--o{ autoidentificaciones_etnicas : "pais_id"
  paises ||--o{ estados_civiles : "pais_id"
  paises ||--o{ generos : "pais_id"
  paises ||--o{ instituciones : "pais_id"
  paises ||--o{ parentescos : "pais_id"
  paises ||--o{ tipos_discapacidad : "pais_id"
```

<details>
<summary>Llegan 3 claves ajenas desde otros diagramas</summary>

`persona_autoidentificacion.autoidentificacion_etnica_id` → `autoidentificaciones_etnicas` · `persona_autoidentificacion.genero_id` → `generos` · `persons.estado_civil_id` → `estados_civiles`

</details>

### Fuera de los subgrupos

**3 tablas** · 40 columnas · 10 claves ajenas propias. Apunta a `autoidentificaciones_etnicas`, `cantones`, `categorias_visa`, `generos`, `paises`, `persons`, `provincias`, que salen como caja vacía.

```mermaid
erDiagram
  %% generado por scripts/docs/gen-mapa-campos.mjs: no se edita a mano
  documentos_identidad {
    int id PK
    int person_id FK
    text tipo
    int categoria_visa_id FK
    int pais_id FK
    varchar numero
    smallint verificado
    timestamp verificado_at
    date emitido_el
    date expira_el
    varchar escaneo_ref
    timestamp escaneo_subido_at
    smallint principal
    smallint principal_flag
    smallint is_active
    timestamp created_at
    timestamp updated_at
  }
  persona_autoidentificacion {
    int person_id PK, FK
    int genero_id FK
    int autoidentificacion_etnica_id FK
    timestamp created_at
    timestamp updated_at
  }
  direcciones {
    int id PK
    int person_id FK
    text tipo
    int pais_id FK
    int provincia_id FK
    int canton_id FK
    varchar sector
    varchar barrio
    varchar calle_primaria
    varchar calle_secundaria
    varchar referencia
    numeric latitud
    numeric longitud
    smallint principal
    smallint principal_flag
    smallint is_active
    timestamp created_at
    timestamp updated_at
  }
  cantones |o--o{ direcciones : "canton_id"
  paises |o--o{ direcciones : "pais_id"
  persons ||--o{ direcciones : "person_id"
  provincias |o--o{ direcciones : "provincia_id"
  categorias_visa |o--o{ documentos_identidad : "categoria_visa_id"
  paises ||--o{ documentos_identidad : "pais_id"
  persons ||--o{ documentos_identidad : "person_id"
  autoidentificaciones_etnicas |o--o{ persona_autoidentificacion : "autoidentificacion_etnica_id"
  generos |o--o{ persona_autoidentificacion : "genero_id"
  persons ||--o| persona_autoidentificacion : "person_id"
```

### Cómo se te localiza

**6 tablas** · 49 columnas · 7 claves ajenas propias. Apunta a `paises`, `persons`, que salen como caja vacía.

```mermaid
erDiagram
  %% generado por scripts/docs/gen-mapa-campos.mjs: no se edita a mano
  emails {
    int id PK
    int person_id FK
    text tipo
    varchar direccion UK
    smallint verificado
    timestamp verificado_at
    smallint principal
    smallint principal_flag
    smallint is_active
    timestamp created_at
    timestamp updated_at
  }
  telefonos {
    int id PK
    int person_id FK
    text tipo
    int pais_id FK
    varchar numero
    smallint principal
    smallint principal_flag
    smallint is_active
    timestamp created_at
    timestamp updated_at
  }
  telefono_canales {
    int id PK
    int telefono_id FK
    int canal_id FK
    smallint verificado
    timestamp verificado_at
    timestamp created_at
    timestamp updated_at
  }
  canales_mensajeria {
    int id PK
    varchar code UK
    varchar name
    smallint is_active
    timestamp created_at
    timestamp updated_at
  }
  telefono_verification_keys {
    bigint id PK
    int telefono_id FK
    char llave_hash UK
    timestamp expira_at
    timestamp consumida_at
    int canal_id FK
    timestamp created_at
  }
  canales_bitacora {
    bigint id PK
    varchar canal
    varchar salud
    varchar evidencia
    text detalle
    timestamp desde
    timestamp hasta
    timestamp avisado_at
  }
  persons ||--o{ emails : "person_id"
  canales_mensajeria ||--o{ telefono_canales : "canal_id"
  telefonos ||--o{ telefono_canales : "telefono_id"
  canales_mensajeria |o--o{ telefono_verification_keys : "canal_id"
  telefonos ||--o{ telefono_verification_keys : "telefono_id"
  paises |o--o{ telefonos : "pais_id"
  persons ||--o{ telefonos : "person_id"
```

<details>
<summary>Llega 1 clave ajena desde otros diagramas</summary>

`email_verification_codes.email_id` → `emails`

</details>

### Que eres tú quien firma

**4 tablas** · 24 columnas · 3 claves ajenas propias. Apunta a `emails`, `persons`, que salen como caja vacía.

```mermaid
erDiagram
  %% generado por scripts/docs/gen-mapa-campos.mjs: no se edita a mano
  person_certificates {
    int id PK
    int person_id FK
    varchar label
    varchar original_filename
    varchar bucket
    varchar object_name
    smallint is_default
    timestamp created_at
    timestamp updated_at
  }
  email_verification_codes {
    bigint id PK
    int email_id FK
    varchar code_hash
    timestamp expires_at
    timestamp created_at
  }
  password_reset_codes {
    bigint id PK
    int person_id FK
    varchar code_hash
    timestamp expires_at
    smallint used
    timestamp created_at
  }
  intentos_limitados {
    bigint id PK
    varchar accion
    varchar sujeto
    timestamp ocurrido_at
  }
  emails ||--o{ email_verification_codes : "email_id"
  persons ||--o{ password_reset_codes : "person_id"
  persons ||--o{ person_certificates : "person_id"
```

### Lo que sobrevive a la persona

**3 tablas** · 26 columnas · 1 clave ajena propia.

```mermaid
erDiagram
  %% generado por scripts/docs/gen-mapa-campos.mjs: no se edita a mano
  documentos_legales {
    int id PK
    varchar clase UK
    varchar version
    char contenido_hash
    varchar bucket
    varchar object_key
    varchar object_version_id
    text estado
    timestamp publicado_at
    timestamp created_at
  }
  consentimientos {
    bigint id PK
    int person_id
    int documento_id FK
    timestamp aceptado_at
    varchar ip
    timestamp revocado_at
  }
  accesos_sensibles {
    bigint id PK
    int titular_person_id
    int actor_person_id
    text recurso
    varchar tabla
    bigint registro_id
    text accion
    jsonb detalle
    varchar ip
    timestamp ocurrido_at
  }
  documentos_legales ||--o{ consentimientos : "documento_id"
```

### Qué has hecho antes

**2 tablas** · 10 columnas · 2 claves ajenas propias. Apunta a `persons`, que sale como caja vacía.

```mermaid
erDiagram
  %% generado por scripts/docs/gen-mapa-campos.mjs: no se edita a mano
  dossiers {
    bigint id PK
    int person_id FK, UK
    timestamp created_at
    timestamp updated_at
  }
  dossier_items {
    bigint id PK
    bigint dossier_id FK
    varchar section
    jsonb data
    text url_documento
    timestamp created_at
  }
  dossiers ||--o{ dossier_items : "dossier_id"
  persons ||--o| dossiers : "person_id"
```

## 2 · Lo que la organización *hace* con ella

### Qué puedes hacer

**8 tablas** · 49 columnas · 12 claves ajenas propias. Apunta a `cargos`, `persons`, `position_assignments`, `relation_unit_types`, `units`, que salen como caja vacía.

```mermaid
erDiagram
  %% generado por scripts/docs/gen-mapa-campos.mjs: no se edita a mano
  resources {
    int id PK
    varchar code UK
    varchar name
    varchar description
    smallint is_active
    timestamp created_at
    timestamp updated_at
  }
  permissions {
    int id PK
    int resource_id FK
    int action_id FK
    varchar code UK
    varchar description
    smallint is_active
    timestamp created_at
    timestamp updated_at
  }
  actions {
    int id PK
    varchar code UK
    varchar name
    varchar description
    smallint is_active
    timestamp created_at
    timestamp updated_at
  }
  role_permissions {
    int id PK
    int role_id FK
    int permission_id FK
  }
  roles {
    int id PK
    varchar name UK
    varchar description
    smallint is_active
  }
  role_assignments {
    int id PK
    int role_id FK
    int unit_id FK
    int derived_from_assignment_id FK
    text source
    int person_id FK
    int max_depth
    date start_date
    date end_date
    smallint is_current
    smallint current_flag
    timestamp assigned_at
    timestamp revoked_at
    varchar revoked_reason
  }
  cargo_role_map {
    int id PK
    int role_id FK
    int cargo_id FK
  }
  role_assignment_relation_types {
    int id PK
    int relation_type_id FK
    int role_assignment_id FK
  }
  cargos ||--o{ cargo_role_map : "cargo_id"
  roles ||--o{ cargo_role_map : "role_id"
  actions ||--o{ permissions : "action_id"
  resources ||--o{ permissions : "resource_id"
  relation_unit_types ||--o{ role_assignment_relation_types : "relation_type_id"
  role_assignments ||--o{ role_assignment_relation_types : "role_assignment_id"
  persons ||--o{ role_assignments : "person_id"
  position_assignments |o--o{ role_assignments : "derived_from_assignment_id"
  roles ||--o{ role_assignments : "role_id"
  units ||--o{ role_assignments : "unit_id"
  permissions ||--o{ role_permissions : "permission_id"
  roles ||--o{ role_permissions : "role_id"
```

<details>
<summary>Llega 1 clave ajena desde otros diagramas</summary>

`vacancy_visibility.role_id` → `roles`

</details>

### A quién se contrata

**8 tablas** · 55 columnas · 15 claves ajenas propias. Apunta a `persons`, `roles`, `unit_positions`, `units`, que salen como caja vacía.

```mermaid
erDiagram
  %% generado por scripts/docs/gen-mapa-campos.mjs: no se edita a mano
  vacancies {
    int id PK
    varchar title
    varchar category
    varchar dedication
    varchar relation_type
    text status
    smallint open_flag
    varchar profile_ref
    timestamp opened_at
    timestamp closed_at
    int position_id FK
    timestamp created_at
    timestamp updated_at
  }
  vacancy_visibility {
    int id PK
    int vacancy_id FK
    int unit_id FK
    int role_id FK
    timestamp created_at
  }
  aplications {
    int id PK
    int person_id FK
    int vacancy_id FK
    text status
    smallint selected_flag
    timestamp applied_at
    timestamp updated_at
    varchar note
  }
  offers {
    int id PK
    int application_id FK
    text status
    smallint active_flag
    text terms_snapshot
    timestamp sent_at
    timestamp responded_at
    timestamp expires_at
    timestamp created_at
  }
  contracts {
    int id PK
    int person_id FK
    int position_id FK
    varchar relation_type
    varchar dedication
    date start_date
    date end_date
    text status
    timestamp created_at
    timestamp updated_at
  }
  contract_origins {
    int contract_id PK, FK
    text origin_type
    timestamp created_at
  }
  contract_origin_recruitment {
    int contract_id PK, FK
    int offer_id FK, UK
    int vacancy_id FK, UK
    timestamp created_at
  }
  contract_origin_renewal {
    int contract_id PK, FK
    int renewed_from_contract_id FK
    timestamp created_at
  }
  persons ||--o{ aplications : "person_id"
  vacancies ||--o{ aplications : "vacancy_id"
  contract_origins ||--o| contract_origin_recruitment : "contract_id"
  offers ||--o| contract_origin_recruitment : "offer_id"
  vacancies ||--o| contract_origin_recruitment : "vacancy_id"
  contract_origins ||--o| contract_origin_renewal : "contract_id"
  contracts ||--o{ contract_origin_renewal : "renewed_from_contract_id"
  contracts ||--o| contract_origins : "contract_id"
  persons ||--o{ contracts : "person_id"
  unit_positions ||--o{ contracts : "position_id"
  aplications ||--o{ offers : "application_id"
  unit_positions ||--o{ vacancies : "position_id"
  roles |o--o{ vacancy_visibility : "role_id"
  units |o--o{ vacancy_visibility : "unit_id"
  vacancies ||--o{ vacancy_visibility : "vacancy_id"
```

## 3 · Lo que se dice por el camino

### Cómo se habla

**6 tablas** · 52 columnas · 17 claves ajenas propias. Apunta a `persons`, `process_definition_versions`, `processes`, `units`, que salen como caja vacía.

```mermaid
erDiagram
  %% generado por scripts/docs/gen-mapa-campos.mjs: no se edita a mano
  chat_conversations {
    bigint id PK
    text type
    text title
    int process_id FK
    int scope_process_id FK
    int scope_unit_id FK
    varchar stable_key UK
    int scope_current_definition_id FK
    int scope_origin_definition_id FK
    int created_by FK
    bigint last_message_id
    timestamp last_message_at
    timestamp archived_at
    text mobile_summary
    timestamp created_at
    timestamp updated_at
  }
  chat_conversation_participants {
    bigint id PK
    bigint conversation_id FK
    int person_id FK
    varchar role
    timestamp joined_at
    timestamp left_at
  }
  chat_messages {
    bigint id PK
    bigint conversation_id FK
    int sender_person_id FK
    text content
    varchar content_type
    bigint reply_to_message_id FK
    timestamp edited_at
    timestamp deleted_at
    varchar delivery_state
    timestamp created_at
  }
  chat_message_attachments {
    bigint id PK
    bigint message_id FK
    int sort_order
    varchar path
    varchar filename
    varchar mime
    bigint size
  }
  chat_message_reads {
    bigint message_id FK
    int person_id FK
    timestamp read_at
  }
  chat_notifications {
    bigint id PK
    int recipient_person_id FK
    varchar type
    text title
    text body
    bigint conversation_id FK
    bigint message_id FK
    varchar channel
    timestamp read_at
    timestamp created_at
  }
  chat_conversations ||--o{ chat_conversation_participants : "conversation_id"
  persons ||--o{ chat_conversation_participants : "person_id"
  persons ||--o{ chat_conversations : "created_by"
  processes |o--o{ chat_conversations : "process_id"
  process_definition_versions |o--o{ chat_conversations : "scope_current_definition_id"
  process_definition_versions |o--o{ chat_conversations : "scope_origin_definition_id"
  processes |o--o{ chat_conversations : "scope_process_id"
  units |o--o{ chat_conversations : "scope_unit_id"
  chat_messages ||--o{ chat_message_attachments : "message_id"
  chat_messages ||--o{ chat_message_reads : "message_id"
  persons ||--o{ chat_message_reads : "person_id"
  chat_conversations ||--o{ chat_messages : "conversation_id"
  chat_messages |o--o{ chat_messages : "reply_to_message_id"
  persons ||--o{ chat_messages : "sender_person_id"
  chat_conversations |o--o{ chat_notifications : "conversation_id"
  chat_messages |o--o{ chat_notifications : "message_id"
  persons ||--o{ chat_notifications : "recipient_person_id"
```

### Fuera de los subgrupos

**2 tablas** · 19 columnas · 1 clave ajena propia. Apunta a `persons`, que sale como caja vacía.

```mermaid
erDiagram
  %% generado por scripts/docs/gen-mapa-campos.mjs: no se edita a mano
  relation_unit_types {
    int id PK
    varchar code UK
    varchar name
    varchar description
    smallint is_inheritance_allowed
    smallint is_active
    timestamp created_at
    timestamp updated_at
  }
  signature_batch_jobs {
    char job_id PK
    int user_id FK
    varchar sign_mode
    varchar status
    int total
    int processed
    int success_count
    int failed_count
    jsonb results
    timestamp created_at
    timestamp updated_at
  }
  persons |o--o{ signature_batch_jobs : "user_id"
```

<details>
<summary>Llegan 3 claves ajenas desde otros diagramas</summary>

`fill_flow_steps.relation_type_id` → `relation_unit_types` · `role_assignment_relation_types.relation_type_id` → `relation_unit_types` · `unit_relations.relation_type_id` → `relation_unit_types`

</details>
