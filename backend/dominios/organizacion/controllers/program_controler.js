import { getPostgresPool } from "../../../config/postgres.js";
import { listUnits } from "../datos/unitListing.js";
import SqlAdminService from "../../../services/admin/SqlAdminService.js";

// ⚠️ PEREZOSO, Y ES EL ARREGLO DE FONDO DE UN FALLO QUE APARECIO DOS VECES (2026-10-07).
//
// `const service = new SqlAdminService()` a nivel de modulo construia el editor generico —y sus seis
// subservicios— con solo IMPORTAR este fichero. Y este fichero entra en cadenas largas: la puerta de
// su dominio reexporta `createProgram`, asi que basta con que alguien importe
// `dominios/organizacion/index.js` —lo hace `DocumentoIdentidadService`, que importa
// `templateLifecycle`, que importa `SqlAdminService`— para cerrar un ciclo y reventar con
// «Cannot access 'SqlAdminService' before initialization».
//
// ESM tolera los ciclos; lo que no tolera es USAR una referencia antes de que se inicialice. Por eso
// la respuesta no es romper el ciclo ni debilitar la puerta: es no instanciar al cargar. Quedan otros
// CUATRO controllers con `new SqlAdminService()` a nivel de modulo —proceso, sql_admin, supervision y
// user_controler—, y son la misma mina esperando otro orden de carga.
let service = null;
const editor = () => (service ??= new SqlAdminService());

export const createProgram = async (req, res) => {
  console.log("Creando Nueva Unidad (compat /program)");
  try {
    const payload = { ...(req.body ?? {}) };
    if (!payload.slug && payload.code) {
      payload.slug = payload.code;
    }
    const created = await editor().create("units", payload);
    res.json(created);
  } catch (error) {
    console.log("Error Creating Unit")
    console.error(error.message);
    res.status(400).send({
      message: "Error al crear la unidad",
      error: error.message
    });
  }
};

export const getPrograms = async (req, res) => {
  console.log("Listando unidades (compat /program)");
  try {
    const pool = getPostgresPool();
    if (!pool) {
      return res.status(500).json({ message: "Conexion PostgreSQL no disponible" });
    }

    const rows = await listUnits(pool, {
      unitTypeId: req.query.unit_type_id,
      unitType: req.query.unit_type,
      isActive: req.query.is_active,
    });
    res.json(rows);
  } catch (error) {
    console.log("Error Listando Unidades")
    res.status(500).json({ message: error.message });
  }
};
