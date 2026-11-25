import { getPostgresPool } from "../../config/postgres.js";
import {
  ACTION_CATALOG,
  PERMISSION_CATALOG,
  RESOURCE_CATALOG,
  ROLE_PERMISSION_MATRIX,
  permissionCode
} from "../../config/rbacCatalog.js";

// El catalogo RBAC del codigo, llevado a una base YA INSTALADA, en cada arranque (frente 20, P8).
//
// POR QUE EXISTE. El catalogo solo llegaba a la base por `seedBaseRbacCatalog`, y esa funcion solo
// corre desde `POST /system/bootstrap/initialize` -- 409 en cuanto hay instalacion-- y desde
// `npm run recover:admin`. Asi que un recurso nuevo en `rbacCatalog.js` NO LLEGABA NUNCA a una base
// existente. Y desde que una tabla sin permiso queda cerrada, eso no es un permiso de menos: son
// tablas enteras (catalogos, datos sensibles, la bitacora) inaccesibles para todos menos AdminSistema.
//
// POR QUE NO SE REUTILIZA `seedBaseRbacCatalog` NI SUS UPSERTS, aunque sea lo primero que se piensa:
// estan hechos para una instalacion, no para una base viva.
//   - Borran y reescriben `role_permissions` de cada rol: al arrancar desharian cada permiso que un
//     administrador haya quitado a mano.
//   - Sus upserts hacen `is_active = 1` y pisan nombre y descripcion: reactivarian un permiso que
//     alguien desactivo.
//   - Y ninguno dice si la fila la acaba de crear, que es justo lo que decide si se concede.
// Lo que SI se comparte es el catalogo y la forma de cada permiso (`PERMISSION_CATALOG`), para que un
// permiso llegado por aqui sea identico al sembrado en la instalacion.
//
// LAS REGLAS, y cada una cierra una forma de hacer daño:
//   1. SOLO AÑADE. Inserta los recursos, acciones y permisos que falten; no actualiza ni borra nada.
//   2. SOLO CONCEDE LO QUE ACABA DE CREAR, segun ROLE_PERMISSION_MATRIX. Un permiso que ya existia no
//      se vuelve a conceder: si un rol no lo tiene, es porque alguien se lo quito, y el arranque no es
//      quien para devolverselo.
//   3. SIN ROLES NO HAY INSTALACION, y no hace nada: sembrar una base virgen es del bootstrap.
//   4. TODO EN UNA TRANSACCION. Sin ella, un fallo entre crear el permiso y concederlo lo dejaria
//      creado y SIN CONCEDER PARA SIEMPRE: al arranque siguiente ya «existia», y la regla 2 lo daria
//      por quitado a mano.
//
// Dos arranques a la vez no se pisan: el segundo INSERT espera en el indice unico a que el primero
// confirme, y entonces no inserta nada -- asi que no concede nada, y concede solo el primero.
//
// ⚠️ LO QUE NO PUEDE DISTINGUIR: un permiso BORRADO de `permissions` a mano (no quitado a un rol,
// borrado) es indistinguible de uno que nunca existio, y vuelve con sus concesiones. Quitar un
// permiso a un rol es `role_permissions`; eso se respeta.
//
// Los roles NO se crean aqui: un rol nuevo en ROLE_CATALOG sigue necesitando el bootstrap o
// `recover:admin`. Sus concesiones se saltan mientras el rol no exista.

const codigosExistentes = async (conexion, sql) => {
  const [filas] = await conexion.query(sql);
  return new Set((filas ?? []).map((fila) => String(fila.code)));
};

const idsPorCodigo = async (conexion, sql) => {
  const [filas] = await conexion.query(sql);
  return new Map((filas ?? []).map((fila) => [String(fila.code), Number(fila.id)]));
};

// Inserta cada entrada que falte y devuelve los codigos que ESTA llamada creo de verdad. El
// `ON CONFLICT DO NOTHING` no es redundante con la lectura previa: es lo que resuelve la carrera entre
// dos arranques, y `affectedRows` a 0 es como se entera de que la fila ya la puso otro.
const insertarLasQueFalten = async (conexion, { existentes, catalogo, insertar }) => {
  const presentes = await codigosExistentes(conexion, existentes);
  const creados = [];
  for (const entrada of catalogo.filter((item) => !presentes.has(item.code))) {
    const [resultado] = await conexion.query(insertar, entrada.valores);
    if (Number(resultado?.affectedRows) > 0) {
      creados.push(entrada.code);
    }
  }
  return creados;
};

export async function sincronizarCatalogoRbac(pool = getPostgresPool()) {
  if (!pool) {
    throw new Error("Conexion PostgreSQL no disponible.");
  }
  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();

    const [[fila] = []] = await conexion.query("SELECT COUNT(*) AS total FROM roles");
    if (Number(fila?.total ?? 0) === 0) {
      await conexion.rollback();
      return { instalado: false, recursos: [], acciones: [], permisos: [], concesiones: 0 };
    }

    const recursos = await insertarLasQueFalten(conexion, {
      existentes: "SELECT code FROM resources",
      catalogo: RESOURCE_CATALOG.map((recurso) => ({
        code: recurso.code,
        valores: [recurso.code, recurso.name, recurso.description]
      })),
      insertar: `INSERT INTO resources (code, name, description, is_active)
                 VALUES (?, ?, ?, 1) ON CONFLICT DO NOTHING`
    });

    const acciones = await insertarLasQueFalten(conexion, {
      existentes: "SELECT code FROM actions",
      catalogo: ACTION_CATALOG.map((accion) => ({
        code: accion.code,
        valores: [accion.code, accion.name, accion.description]
      })),
      insertar: `INSERT INTO actions (code, name, description, is_active)
                 VALUES (?, ?, ?, 1) ON CONFLICT DO NOTHING`
    });

    const idsRecurso = await idsPorCodigo(conexion, "SELECT id, code FROM resources");
    const idsAccion = await idsPorCodigo(conexion, "SELECT id, code FROM actions");
    const permisos = await insertarLasQueFalten(conexion, {
      existentes: "SELECT code FROM permissions",
      catalogo: PERMISSION_CATALOG.map((permiso) => ({
        code: permiso.code,
        valores: [
          idsRecurso.get(permiso.resourceCode),
          idsAccion.get(permiso.actionCode),
          permiso.code,
          permiso.description
        ]
      })),
      insertar: `INSERT INTO permissions (resource_id, action_id, code, description, is_active)
                 VALUES (?, ?, ?, ?, 1) ON CONFLICT DO NOTHING`
    });

    let concesiones = 0;
    if (permisos.length) {
      const nuevos = new Set(permisos);
      const idsPermiso = await idsPorCodigo(conexion, "SELECT id, code FROM permissions");
      const idsRol = await idsPorCodigo(conexion, "SELECT id, name AS code FROM roles");
      for (const [rol, matriz] of Object.entries(ROLE_PERMISSION_MATRIX)) {
        const roleId = idsRol.get(rol);
        if (!roleId) continue;
        for (const [recurso, accionesDelRol] of Object.entries(matriz)) {
          for (const accion of accionesDelRol) {
            const codigo = permissionCode(recurso, accion);
            if (!nuevos.has(codigo)) continue;
            const [resultado] = await conexion.query(
              "INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?) ON CONFLICT DO NOTHING",
              [roleId, idsPermiso.get(codigo)]
            );
            concesiones += Number(resultado?.affectedRows) > 0 ? 1 : 0;
          }
        }
      }
    }

    await conexion.commit();
    return { instalado: true, recursos, acciones, permisos, concesiones };
  } catch (error) {
    await conexion.rollback().catch(() => {});
    throw error;
  } finally {
    conexion.release();
  }
}
