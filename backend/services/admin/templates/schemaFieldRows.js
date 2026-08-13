// Las FILAS de campos de una plantilla: los campos que el usuario rellenara en la web. Es el UNICO
// sitio del dominio de plantillas que inserta en `template_artifact_fields`.
//
// POR QUE EXISTE (sub-paso S6 del §0.4 del plan maestro). Los campos vivian SOLO como fichero
// —`schema.json` en el prefijo de MinIO del artifact—, sin ninguna tabla. Tres problemas medidos, que
// son los mismos que el §0.8 cerro para el flujo y que estaban vivos para los campos:
//
//   1. SE COPIABAN EN BINARIO AL VERSIONAR. `createTemplateArtifactVersion` y
//      `forkDeliverableForConfig` clonan el prefijo entero con `copyMinioObjectBinary`, o sea el
//      MISMO tubo por el que viajaba el `document_owner` que costo el frente 0. Bytes copiados no se
//      auditan ni se migran con un UPDATE. Lo cierra `copySchemaFieldsToArtifact`, aqui abajo.
//   2. NO SE PODIAN VALIDAR CONTRA NADA. Un `x-deasy-field-code` que diga
//      "signatures.elaborado.token" no se contrasta con `signature_flow_steps.slot` mientras uno sea
//      texto dentro de un objeto y el otro una columna. Con `field_code` como columna, es un JOIN —
//      y ese JOIN es lo que el generador (S8) necesita para colocar el token de firma sin que el
//      usuario lo ponga a mano. NO se hace aqui: S6 deja el esqueleto, no el generador.
//   3. EL ORDEN ERA EL DE LAS CLAVES DE UN OBJETO JS, que no es un orden. `field_order` lo arregla;
//      el detalle medido esta en `normalizeSchemaFieldList` (`templateLifecycle.js`).
//
// ESCRITURA DOBLE, COMO EN EL SUB-PASO 3 DEL §0.8. Estas filas y el `schema.json` de MinIO salen del
// MISMO objeto en memoria: `normalizeSchemaFieldList` produce la lista UNA vez, `_writeDraftPackage`
// la vuelca al fichero y `_persistDraftToDatabase` la vuelca aqui. Los LECTORES siguen leyendo el
// fichero — se mudan de uno en uno despues, que es lo que dejo cada paso del §0.8 en verde y
// reversible.
//
// NO DEPENDE DE this.pool NI DE NINGUN SERVICIO: recibe la `connection` por parametro, asi que el
// llamador decide si va suelto o dentro de una transaccion. Los tres llamadores de hoy —guardar
// borrador, versionar y bifurcar— la llaman DENTRO de la suya, por la misma razon que el flujo: los
// campos cuelgan del artifact por FK, y un fallo posterior dejaria una edicion sin sus campos.

// DELETE + INSERT, no UPSERT, y es la misma decision que en `replaceFillFlowSteps`: los campos son
// una LISTA ORDENADA y un campo no tiene identidad propia mas alla de su `data_key` dentro de la
// edicion. Reconciliar campo a campo obligaria a decidir que es "el mismo campo" cuando el usuario
// renombra la clave, y no hay respuesta.
//
// La lista llega YA NORMALIZADA y deduplicada por `normalizeSchemaFieldList`, que es quien conoce el
// catalogo de componentes y las reglas de slug. Este modulo no normaliza nada: si lo hiciera habria
// dos normalizadores y el fichero y las filas podrian discrepar, que es justo lo que la escritura
// doble desde un solo objeto viene a impedir.
export const replaceSchemaFieldsForArtifact = async (
  connection,
  { artifactId, fields = [] } = {}
) => {
  const id = Number(artifactId);
  if (!id) {
    throw new Error("replaceSchemaFieldsForArtifact requiere el id del template_artifact.");
  }

  // El DELETE va SIEMPRE, tambien con la lista vacia: quitar todos los campos desde el editor tiene
  // que dejar la edicion sin ninguno. Sin esto, vaciar el formulario dejaria las filas viejas y la
  // base contradiria al `schema.json`, que si se reescribe a `{}`.
  await connection.query(
    "DELETE FROM template_artifact_fields WHERE template_artifact_id = ?",
    [id]
  );

  for (const campo of fields) {
    await connection.query(
      `INSERT INTO template_artifact_fields (
         template_artifact_id,
         field_order,
         data_key,
         field_code,
         title,
         ui_component,
         ui_group,
         is_required
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        campo.order,
        campo.dataKey,
        campo.fieldCode,
        campo.title,
        campo.component,
        campo.group,
        campo.required ? 1 : 0,
      ]
    );
  }

  return { fields: fields.length };
};

// --- El OTRO productor: un `schema.json` que ya existe como fichero -------------------------------
//
// EL SEED BASE TRAE 18 CAMPOS ESCRITOS A MANO, y no llegan por el formulario. `publishBaseSeedAssets`
// (`SystemBootstrapService.js`) publica `seeds/informe-general/schema.json` tal cual en el prefijo
// del artifact del Proceso por defecto, y el `INSERT INTO template_artifacts` del bootstrap solo
// guarda el PUNTERO al fichero. O sea: la unica plantilla que existe recien instalado el sistema
// tenia sus campos exclusivamente en MinIO.
//
// ES LA MISMA FORMA DEL `BASE_META_YAML` QUE COSTO EL FRENTE 0 ENTERO: contenido del modelo que
// entra por un literal de fichero, se auto-replica al versionar por copia binaria, y no aparece en
// ninguna tabla. Sin este productor, `template_artifact_fields` naceria VACIA justo para la
// plantilla de la que derivan todos los entregables de dev, y el esqueleto que este sub-paso deja
// para el generador no tendria nada dentro.
//
// Y es justo el fichero donde vive el caso de uso del S8: sus `x-deasy-field-code` incluyen
// `signatures.elaborado.token`, `signatures.revisado.token` y `signatures.aprobado.token`, que son
// los que habra que unir con `signature_flow_steps.slot`.
//
// NO ES UN SEGUNDO NORMALIZADOR de la entrada del formulario —eso seria la duplicacion que la
// escritura doble prohibe—: es un productor DISTINTO, de un formato DISTINTO (JSON Schema ya
// construido), que desemboca en la misma forma de fila. La entrada del formulario sigue teniendo un
// solo normalizador, `normalizeSchemaFieldList`.
//
// EL ORDEN sale del orden de claves de `properties`, que es lo unico que hay en un fichero. Es el
// orden roto que describe `normalizeSchemaFieldList` —y aqui no se puede hacer mejor, porque el dato
// de origen ya lo perdio—; en el seed base ninguna clave es un entero canonico, asi que el orden que
// se guarda es el que el fichero declara.
export const schemaFieldListFromJsonSchema = (schema = {}) => {
  const properties = schema?.properties && typeof schema.properties === "object" ? schema.properties : {};
  const requiredSet = new Set(Array.isArray(schema?.required) ? schema.required : []);
  const lista = [];
  const vistos = new Set();
  for (const [clave, def] of Object.entries(properties)) {
    const dataKey = String(def?.["x-deasy-data-key"] || clave).trim();
    if (!dataKey || vistos.has(dataKey)) continue;
    vistos.add(dataKey);
    const group = String(def?.["x-deasy-ui"]?.group || "general").trim() || "general";
    lista.push({
      order: lista.length + 1,
      dataKey,
      title: String(def?.title || dataKey).slice(0, 180),
      fieldCode: String(def?.["x-deasy-field-code"] || `${group}.${dataKey}`).trim(),
      // El componente NO se valida contra el catalogo aqui, y es deliberado: quien lo valida es el
      // `CHECK` de la columna. Un seed con un componente inventado tiene que reventar el bootstrap,
      // no colarse degradado a `text` — que es lo que hace el formulario con la entrada del usuario,
      // donde degradar SI es lo correcto porque el usuario no controla lo que manda el navegador.
      component: String(def?.["x-deasy-ui"]?.component || "text").trim() || "text",
      group,
      required: requiredSet.has(dataKey) || requiredSet.has(clave),
    });
  }
  return lista;
};

// --- Copia: los campos del PADRE pasan a colgar de la HIJA ---------------------------------------
//
// Sub-paso 6 del §0.8, aplicado a los campos. `createTemplateArtifactVersion` y
// `forkDeliverableForConfig` copian los objetos de MinIO EN BINARIO, asi que `schema.json` viajaba
// solo — y con el, cualquier campo heredado sin pasar por la web, exactamente como se auto-replicaba
// el `document_owner`. Copiando FILAS, la edicion hija nace con sus campos CONTABLES: se pueden
// listar, unir y migrar con un UPDATE.
//
// Mientras dure la escritura doble las dos copias coexisten y dicen lo mismo. Sin esta funcion NO
// dirian lo mismo: el fichero de la hija llevaria los campos y su tabla estaria vacia, que es la
// divergencia que la escritura doble existe para evitar.
//
// SE LEEN LAS MISMAS COLUMNAS QUE EL INSERT ESCRIBE, ni una mas, y se reescriben POR EL ESCRITOR DE
// SIEMPRE en vez de con un `INSERT ... SELECT`. Es la razon por la que `flowRows.js` no lo hace
// tampoco: un `INSERT ... SELECT` seria un SEGUNDO escritor con su propia lista de columnas, y estos
// modulos existen para que haya UNO. Si manana se anade una columna al INSERT, la copia la arrastra
// sola.
const readSchemaFieldsForCopy = async (connection, artifactId) => {
  const [rows] = await connection.query(
    `SELECT field_order, data_key, field_code, title, ui_component, ui_group, is_required
     FROM template_artifact_fields
     WHERE template_artifact_id = ?
     ORDER BY field_order ASC, id ASC`,
    [artifactId]
  );
  return rows.map((row) => ({
    order: Number(row.field_order) || 0,
    dataKey: row.data_key,
    fieldCode: row.field_code,
    title: row.title,
    component: row.ui_component,
    group: row.ui_group,
    required: Number(row.is_required) !== 0,
  }));
};

// Deja colgando de `targetArtifactId` los mismos campos que hoy definen a `sourceArtifactId`. Ids
// nuevos, contenido identico.
//
// SECUENCIAL A PROPOSITO, sin `Promise.all`: esto se llama DENTRO de una transaccion, y una conexion
// sola no atiende dos consultas a la vez.
export const copySchemaFieldsToArtifact = async (
  connection,
  { sourceArtifactId, targetArtifactId } = {}
) => {
  const source = Number(sourceArtifactId);
  const target = Number(targetArtifactId);
  if (!source || !target) {
    throw new Error("copySchemaFieldsToArtifact requiere el id de origen y el de destino.");
  }
  const fields = await readSchemaFieldsForCopy(connection, source);
  return replaceSchemaFieldsForArtifact(connection, { artifactId: target, fields });
};
