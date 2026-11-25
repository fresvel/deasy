// ProcessDefinitionVersionService — lineas, versionado, clonado y contexto de borrador de las
// process definitions. Extraido de SqlAdminService.js (God #1) por Extract Class (cut #4). El cluster
// solo depende de this.pool + getByKeys, inyectado;
// los helpers puros (nombres de version, semver, ids) se importan de los modulos hermanos. SqlAdminService
// mantiene delegadores; el controller y los grafts de create()/update() (que llaman resolve/ensure/clone/
// refresh...) no se tocan.
import { bumpSemanticVersion } from "../kernel/versioning.js";
import { normalizeNumericId } from "../kernel/primitives.js";

export default class ProcessDefinitionVersionService {
  constructor(pool, { getByKeys } = {}) {
    this.pool = pool;
    this._getByKeys = getByKeys;
  }

  ensurePool() {
    if (!this.pool) {
      throw new Error("La conexion con PostgreSQL no esta disponible.");
    }
  }


  // LA IDENTIDAD DE UNA CONFIGURACION ES (LINEA, version). Era `(process_id, variation_key,
  // definition_version)` —tres columnas, una de ellas una COPIA de `series.code`— y el proceso
  // sobra porque la linea ya es de un proceso.
  async ensureProcessDefinitionVersionAvailable(candidate, { excludeId = null } = {}) {
    this.ensurePool();
    const lineaId = normalizeNumericId(candidate?.linea_id);
    const definitionVersion = String(candidate?.definition_version || "").trim();

    if (!lineaId || !definitionVersion) {
      return;
    }

    const params = [lineaId, definitionVersion];
    let query = `
      SELECT id
      FROM process_definition_versions
      WHERE linea_id = ?
        AND definition_version = ?`;

    if (excludeId !== null && excludeId !== undefined && excludeId !== "") {
      query += "\n        AND id <> ?";
      params.push(Number(excludeId));
    }

    query += "\n      LIMIT 1";

    const [rows] = await this.pool.query(query, params);
    if (rows?.length) {
      throw new Error("Ya existe una configuracion con esa version para la linea seleccionada.");
    }
  }


  // LA LINEA de una configuracion. Sustituye a `resolveProcessDefinitionSeries` (frente 25, P9).
  //
  // La serie admitia UN EJE O EL OTRO —su `CHECK` lo imponia y `validation.js` lo repetia—, y como
  // los cargos del catalogo son GENERICOS (`Coordinador`, no «Coordinador de Carrera»), el eje que
  // no cabia habia que ponerlo en `process_target_rules`. Se podia elegir cual iba donde, las dos
  // formas pasaban y significaban cosas distintas: la variacion estaba PARTIDA EN DOS TABLAS. La
  // linea lleva los dos.
  async resolveLinea(candidate, { connection = this.pool } = {}) {
    this.ensurePool();
    const lineaId = normalizeNumericId(candidate?.linea_id);
    if (!lineaId) {
      throw new Error("Selecciona una linea valida para la configuracion.");
    }
    const [rows] = await connection.query(
      `SELECT
         l.id,
         l.process_id,
         l.nombre,
         l.cargo_id,
         l.unit_scope_type,
         l.unit_type_id,
         l.unit_id,
         l.effective_to,
         ut.name AS unit_type_name,
         u.name AS unit_name,
         c.name AS cargo_name
       FROM lineas l
       LEFT JOIN unit_types ut ON ut.id = l.unit_type_id
       LEFT JOIN units u ON u.id = l.unit_id
       LEFT JOIN cargos c ON c.id = l.cargo_id
       WHERE l.id = ?
       LIMIT 1`,
      [lineaId]
    );
    const linea = rows?.[0] || null;
    if (!linea) {
      throw new Error("La linea seleccionada no existe.");
    }
    // Una linea RETIRADA ya no admite configuraciones nuevas: si la obligacion paso a otras manos,
    // lo que sigue viva es su sucesora. Es la mitad en JavaScript de lo que el disparador
    // `trg_linea_anterior_retirada` impone por el otro lado.
    if (linea.effective_to) {
      throw new Error("La linea seleccionada esta retirada y no admite configuraciones nuevas.");
    }
    const processId = normalizeNumericId(candidate?.process_id);
    if (processId && Number(linea.process_id) !== processId) {
      throw new Error("La linea seleccionada pertenece a otro proceso.");
    }
    return linea;
  }


  // El proceso por defecto (slug 'default') es un routed comodin especial: solo puede tener UNA
  // linea — la «sin variacion»: cualquier cargo, todas las unidades. Se permite versionarla (N
  // configuraciones), pero no crear otra linea por cargo o por alcance.
  //
  // ⚠️ ESTE GUARDIA ESTUVO APAGADO, y el apagon no lo delato nada (frente 25, P23 — 2026-10-14).
  // Recibia `processId` del payload del CRUD, y `P22` quito `process_id` del catalogo de la tabla:
  // desde entonces `pickPayload` --que solo copia campos declarados-- le pasaba `undefined` y la
  // primera linea del cuerpo, un `if (!processId) return`, lo devolvia sin comprobar nada. O sea
  // que la regla «el proceso por defecto solo admite la linea sin variacion» dejo de imponerse en
  // silencio, y ningun test lo cubria. Ahora el proceso lo trae LA LINEA, que es quien lo sabe:
  // sin parametro que pueda faltar, no hay nada que apagar.
  async ensureDefaultProcessSingleLinea(linea, { connection = this.pool } = {}) {
    this.ensurePool();
    const processId = normalizeNumericId(linea?.process_id);
    if (!processId) {
      throw new Error("La linea seleccionada no dice de que proceso es.");
    }
    const [rows] = await connection.query(
      "SELECT slug FROM processes WHERE id = ? LIMIT 1",
      [processId]
    );
    if (String(rows?.[0]?.slug || "") !== "default") {
      return;
    }
    const sinVariacion = !linea?.cargo_id && String(linea?.unit_scope_type || "") === "all_units";
    if (!sinVariacion) {
      throw new Error("El proceso por defecto solo admite la linea \"sin variacion\" (cualquier cargo, todas las unidades). Puedes crear nuevas versiones de ella, pero no otra linea por cargo o por alcance.");
    }
  }


  // AQUI VIVIAN LAS DOS RUTINAS DEL NOMBRE ALMACENADO, y se van con la columna (frente 25, P23 —
  // 2026-10-14): `resolveProcessDefinitionVersionName`, que leia `lineas.nombre` para escribirlo en
  // `pdv.name`, y `refreshProcessDefinitionVersionNames`, que recorria las configuraciones de un
  // proceso o de una linea reescribiendo las que se habian quedado atras.
  //
  // La segunda es la prueba de que la copia no se sostenia: existia para arreglar a mano lo que la
  // copia rompia, colgaba del unico gancho que ya no podia cambiar nada (`processes.afterUpdate`,
  // y el nombre es el de la LINEA desde `P9`) y hacia su UPDATE fila a fila fuera de transaccion.
  // Con el nombre derivado en el SELECT no hay nada que resincronizar.

  // Retira las configuraciones activas de UNA LINEA. Se llamaba `...InSeries` y recibia
  // `(processId, variationKey)`: la pareja mas la copia. La linea es una columna.
  async retireActiveDefinitionsInLinea({ lineaId, excludeId = null, connection = this.pool }) {
    this.ensurePool();
    const normalizedLineaId = normalizeNumericId(lineaId);
    if (!normalizedLineaId) {
      return 0;
    }

    const params = [normalizedLineaId];
    let excludeSql = "";
    if (excludeId !== null && excludeId !== undefined && excludeId !== "") {
      excludeSql = " AND id <> ?";
      params.push(Number(excludeId));
    }

    const [activeRows] = await connection.query(
      `SELECT id
       FROM process_definition_versions
       WHERE linea_id = ?
         AND status = 'active'${excludeSql}`,
      params
    );

    if (!activeRows?.length) {
      return 0;
    }

    await connection.query(
      `UPDATE process_definition_versions
       SET status = 'retired',
           effective_to = COALESCE(effective_to, CURDATE())
       WHERE linea_id = ?
         AND status = 'active'${excludeSql}`,
      params
    );

    return activeRows.length;
  }


  async getProcessDefinitionVersion(definitionId, connection = this.pool) {
    this.ensurePool();
    const [rows] = await connection.query(
      // `process_id` SALE DE LA LINEA (frente 25, P22). Se mantiene el NOMBRE del campo porque
      // sus consumidores preguntan «de que proceso es esta configuracion», que sigue siendo la
      // pregunta correcta — lo que cambia es de donde se lee, no lo que significa.
      `SELECT pdv.id, lin.process_id, pdv.linea_id, pdv.status
       FROM process_definition_versions pdv
       INNER JOIN lineas lin ON lin.id = pdv.linea_id
       WHERE pdv.id = ?
       LIMIT 1`,
      [definitionId]
    );
    return rows?.[0] ?? null;
  }


  async ensureDraftDefinitionContext(definitionId, { connection = this.pool, entityLabel = "registros asociados" } = {}) {
    const definition = await this.getProcessDefinitionVersion(definitionId, connection);
    if (!definition) {
      throw new Error("La configuracion de proceso seleccionada no existe.");
    }
    if (String(definition.status || "") !== "draft") {
      throw new Error(`Solo se pueden modificar ${entityLabel} cuando la configuracion esta en draft.`);
    }
    return definition;
  }


  async cloneProcessDefinitionChildren({
    sourceDefinitionId,
    targetDefinitionId,
    targetProcessId,
    templateRemap = null,
    connection = this.pool
  }) {
    const normalizedSourceId = Number(sourceDefinitionId);
    const normalizedTargetId = Number(targetDefinitionId);
    const normalizedTargetProcessId = Number(targetProcessId);

    if (!normalizedSourceId || !normalizedTargetId) {
      return { clonedTemplates: 0, clonedPeriodTypes: 0 };
    }

    const sourceDefinition = await this.getProcessDefinitionVersion(normalizedSourceId, connection);
    if (!sourceDefinition) {
      throw new Error("La configuracion origen para clonar no existe.");
    }
    // ESTE GUARDIA SE QUEDA, Y PROTEGE ALGO QUE NINGUN INDICE MIRA (frente 23, F1.3 — 2026-10-04).
    // Comprueba el proceso pero no la variacion, y por eso parecia un duplicado blando del guardia
    // de pertenencia que se retiro. No lo es: lo que este clon copia no son solo los vinculos de
    // plantilla, son tambien `process_target_rules` y `process_definition_period_types`, que no
    // tienen artefacto y que ninguna restriccion sobre `vinculos` alcanza. Sin
    // esta linea, clonar desde la configuracion de OTRO proceso se traeria sus reglas de alcance y
    // sus tipos de periodo.
    //
    // Y OJO: este clon es lo que hizo imposible F1.1 tal como la escribia el plan. Copia el MISMO
    // `edicion_id` a una definicion nueva de la MISMA linea, asi que un unico sobre esa
    // columna sola lo rechazaba. La regla la impone hoy `trg_vinculo_formato_un_proceso`, que compara la LINEA
    // y por tanto deja pasar este clon — y sigue rechazando el que cruce de linea, que es algo que
    // este guardia no mira porque solo compara el proceso. Ver la nota de `postgres_schema.sql`.
    if (normalizedTargetProcessId && Number(sourceDefinition.process_id) !== normalizedTargetProcessId) {
      throw new Error("Solo se puede clonar desde una configuracion del mismo proceso.");
    }

    // `item_mode` VIAJA CON EL VÍNCULO, y no es opcional. La columna es NOT NULL DEFAULT 'single'
    // (`database/postgres_schema.sql:555`), así que dejarla fuera del clon no da error: convierte en
    // `single` — EN SILENCIO — todo entregable `routed` o `replicated` de la configuración clonada.
    // Como clonar es lo que hace la actualización guiada de plantillas, cada actualización deshacía
    // el modo de emisión. Le pasó al Proceso por defecto en la base de dev: el vínculo original decía
    // `routed` y el de la configuración ACTIVA decía `single`. Al añadir una columna de datos a esta
    // tabla, añádela también aquí y al INSERT de abajo.
    const [templateRows] = await connection.query(
      `SELECT edicion_id, sort_order, item_mode
       FROM vinculos
       WHERE process_definition_id = ?
       ORDER BY sort_order ASC, id ASC`,
      [normalizedSourceId]
    );

    // Aquí se acumulaban avisos no bloqueantes de sincronización de flujos, porque clonar una
    // configuración proyectaba el `meta.yaml` de cada plantilla vinculada y eso podía fallar. Con el
    // sync retirado (sub-paso 8 del §0.8) clonar NO toca ninguna tabla de flujo: el flujo cuelga del
    // ENTREGABLE y las configuraciones lo comparten, así que copiar los vínculos ya lo lleva consigo.
    // Remap opcional de plantilla: re-apunta enlaces de una versión a otra (acción guiada de "actualizar
    // plantilla de config activa": la nueva config debe pinear la NUEVA versión de plantilla).
    const remap = templateRemap && typeof templateRemap === "object" ? templateRemap : null;
    const remapArtifactId = (artifactId) => {
      if (!remap || artifactId == null) return artifactId;
      const mapped = remap[String(artifactId)] ?? remap[Number(artifactId)];
      return mapped != null ? Number(mapped) : artifactId;
    };

    for (const row of templateRows) {
      const targetArtifactId = remapArtifactId(row.edicion_id);
      await connection.query(
        `INSERT INTO vinculos (
          process_definition_id,
          edicion_id,
          sort_order,
          item_mode
        ) VALUES (?, ?, ?, ?)`,
        [
          normalizedTargetId,
          targetArtifactId,
          row.sort_order,
          row.item_mode
        ]
      );
    }

    // AQUI SE CLONABAN LAS REGLAS, y era donde la copia costaba mas: versionar arrastraba el ambito
    // VERBATIM, asi que una configuracion nueva nacia con el reparto congelado en el instante del
    // clon aunque su linea hubiera cambiado despues. Empezo con ocho columnas, `P10` la dejo en dos,
    // `P25` en una, y `P26` retiro la tabla: el afinado es de la LINEA, y las dos versiones de una
    // configuracion comparten linea, asi que no hay nada que copiar — lo comparten de verdad.

    const [periodTypeRows] = await connection.query(
      `SELECT term_type_id,
              is_active
       FROM process_definition_period_types
       WHERE process_definition_id = ?
       ORDER BY id ASC`,
      [normalizedSourceId]
    );

    for (const row of periodTypeRows) {
      await connection.query(
        `INSERT INTO process_definition_period_types (
          process_definition_id,
          term_type_id,
          is_active
        ) VALUES (?, ?, ?)`,
        [
          normalizedTargetId,
          row.term_type_id,
          row.is_active
        ]
      );
    }

    return {
      clonedTemplates: templateRows.length,
      clonedPeriodTypes: periodTypeRows.length
    };
  }


  // EL AMBITO DE LA OBLIGACION, para que la pantalla de reglas sepa que esta heredando.
  //
  // Decia «la serie de un proceso ya fija el cargo» cuatro veces, y la serie se retiro con `P9`
  // (2026-10-11): el codigo ya leia `lineas` y la prosa se habia quedado en el mundo anterior.
  //
  // Esto NO siembra nada. Hasta `P10` (2026-10-14) la regla llevaba copia del cargo y del ambito, y
  // este metodo alimentaba al guardia que las sembraba y las blindaba. Las cuatro columnas se
  // fueron; lo que queda es una LECTURA, y su unico consumidor es el endpoint
  // `/process_definitions/:id/linea-scope`, que la pantalla usa para ENSENAR lo que la linea ya dice.
  async getProcessDefinitionLineaScope(processDefinitionId, connection = this.pool) {
    const defId = normalizeNumericId(processDefinitionId);
    if (!defId) {
      return null;
    }
    const [rows] = await connection.query(
      `SELECT l.unit_scope_type, l.cargo_id, l.unit_type_id, l.unit_id,
              c.name AS cargo_name, ut.name AS unit_type_name
         FROM process_definition_versions pdv
         INNER JOIN lineas l ON l.id = pdv.linea_id
         LEFT JOIN cargos c ON c.id = l.cargo_id
         LEFT JOIN unit_types ut ON ut.id = l.unit_type_id
        WHERE pdv.id = ?
        LIMIT 1`,
      [defId]
    );
    return rows?.[0] || null;
  }


  // AQUI VIVIA `applyTargetRuleLineaConstraints`, 45 lineas que comprobaban que el PUESTO EXACTO de
  // una regla perteneciera al cargo, al tipo de unidad y a la unidad de su linea. Era lo ultimo que
  // quedaba del guardia de 60 lineas de `P10`, y se fue con el puesto (frente 25, P25): la politica
  // que lo pedia no existe, asi que no hay nada que pueda contradecir a la obligacion.

  // Proxima version semver de una configuracion dentro de su LINEA.
  //
  // ⚠️ Esto se contaba por `(process_id, variation_key)`, y ahi habia un defecto real que la linea
  // cierra: `series_id` se elegia EN CADA VERSION, asi que se podia escribir «v1 por Coordinador,
  // v2 por Director» —dos versiones que obligan a gente distinta sin que nada dijera que hubo un
  // traspaso— y encima esa «v2» era la PRIMERA version de la linea del Director, numerada 2. El
  // contador y la realidad dejaban de coincidir y nada lo impedia.
  async getNextProcessDefinitionVersion(lineaId, level = "minor", connection = this.pool) {
    const [rows] = await connection.query(
      `SELECT definition_version FROM process_definition_versions
        WHERE linea_id = ?`,
      [normalizeNumericId(lineaId)]
    );
    let maxKey = -1;
    let maxVersion = "";
    for (const row of rows || []) {
      const m = String(row.definition_version || "").trim().match(/^(\d+)\.(\d+)\.(\d+)$/);
      if (!m) continue;
      const key = Number(m[1]) * 1e6 + Number(m[2]) * 1e3 + Number(m[3]);
      if (key > maxKey) {
        maxKey = key;
        maxVersion = `${m[1]}.${m[2]}.${m[3]}`;
      }
    }
    if (!maxVersion) return "1.0.0";
    return bumpSemanticVersion(maxVersion, level);
  }
}
