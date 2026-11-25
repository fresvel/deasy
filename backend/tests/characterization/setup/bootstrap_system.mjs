// Construye la fixture del harness con el BOOTSTRAP real del sistema.
//
// Antes el golden-master se capturaba contra un seed SQL paralelo (ya eliminado)
// en vez de contra lo que produce una instalación de verdad. Eran dos fuentes de
// verdad: el seed derivaba (su modo --full estaba roto) y, sobre todo, dejaba
// vacía la capa de plantillas, así que el setup tenía que inyectarla escribiendo
// directo al pool y saltándose el guard del endpoint.
//
// El bootstrap sí es la fuente de verdad: es el camino que recorre una
// instalación nueva, y ya siembra la capa de plantillas por la lógica real.
//
// Orden reproducible:
//   1) bash scripts/reset-db.sh dev
//   2) node tests/characterization/setup/bootstrap_system.mjs
//   3) node tests/characterization/setup/seed_execution.mjs
//   4) npm run test:char
//
// Es idempotente: si el sistema ya está inicializado, no hace nada.

import { post, get } from "../lib/http.mjs";
import { waitForReady } from "../lib/readiness.mjs";
import { FIXTURE, USERS } from "../config.mjs";

// ⚠️ EL TOKEN DE FIRMA VA FIJO, para que la fixture sea la misma tras cada reseteo.
//
// `persons.token` es el marcador `!-token-!` que la plantilla deja como hueco de la firma, y el
// bootstrap lo SORTEABA: cada `test:char:fixture` dejaba otro, asi que nada podia citarlo --ni un
// golden, ni una plantilla, ni una nota--. El backend acepta pedirlo desde el 2026-11-10 y sortea
// solo cuando no se pide, asi que una instalacion real no cambia.
//
// Los MISMOS tres valores estan en los datos de ejemplo de
// `frontend/src/modules/auth/views/SystemBootstrapView.vue`, para que un reseteo por el harness y
// uno por la pantalla de `/setup` dejen la base igual. Si cambias uno, cambia el otro.
const TOKEN_DE_FIRMA = {
  admin: "FIRMAdemo1",
  gestor: "FIRMAdemo2",
  usuario: "FIRMAdemo3",
};

const personPayload = (user, firstName, lastName, email, whatsapp = "", signatureToken = "") => ({
  cedula: user.cedula,
  first_name: firstName,
  last_name: lastName,
  email,
  whatsapp,
  password: user.password,
  confirm_password: user.password,
  signature_token: signatureToken,
});

// El bootstrap ofrece los catálogos disponibles en su propio `status`. Los
// tomamos enteros para que la fixture sea la instalación "con todo por defecto".
const buildPreconfig = (catalogOptions = {}) => {
  const idsOf = (key) => (catalogOptions[key] || []).map((option) => option.id);
  return {
    unit_types: idsOf("unit_types"),
    relation_unit_types: true,
    cargos: idsOf("cargos"),
    term_types: idsOf("term_types"),
    example_units: true,
    example_positions: true,
    example_users: true,
  };
};

// La fixture asume que `unitPositionId` vive en `unitId` y tiene un cargo concreto.
// Si el catálogo de ejemplo del bootstrap cambia, hay que enterarse AQUÍ:
//  - unidad equivocada -> 400 opaco tres pasos después ("No tienes una posición
//    vigente en la unidad indicada").
//  - cargo equivocado -> el usuario pierde la elevación de `cargo_role_map` y el
//    test de ownership deja de comprobar ownership sin que nadie se entere.
const assertFixtureOrgMatches = async (token) => {
  const [positionsRes, cargosRes] = await Promise.all([
    get("/admin/sql/unit_positions", { token }),
    get("/admin/sql/cargos", { token }),
  ]);
  const rowsOf = (res) => (Array.isArray(res.body) ? res.body : res.body?.data ?? []);

  const position = rowsOf(positionsRes).find((row) => Number(row.id) === FIXTURE.unitPositionId);
  if (!position) {
    throw new Error(
      `La fixture espera unit_position ${FIXTURE.unitPositionId}, que no existe tras el bootstrap. ` +
        `Ajusta FIXTURE_UNIT_POSITION_ID / FIXTURE_UNIT_ID en config.mjs.`,
    );
  }
  if (Number(position.unit_id) !== FIXTURE.unitId) {
    throw new Error(
      `Desajuste de fixture: unit_position ${FIXTURE.unitPositionId} vive en la unidad ` +
        `${position.unit_id}, pero FIXTURE.unitId es ${FIXTURE.unitId}.`,
    );
  }

  const cargo = rowsOf(cargosRes).find((row) => Number(row.id) === Number(position.cargo_id));
  if (cargo?.code !== FIXTURE.unitPositionCargoCode) {
    throw new Error(
      `Desajuste de fixture: unit_position ${FIXTURE.unitPositionId} tiene cargo ` +
        `"${cargo?.code}", pero la fixture espera "${FIXTURE.unitPositionCargoCode}". ` +
        `El cargo determina la elevación de rol (cargo_role_map) y con ella los permisos ` +
        `que los tests de RBAC dan por supuestos.`,
    );
  }

  console.log(
    "[bootstrap] fixture ok: unit_position %s -> unit %s, cargo %s",
    FIXTURE.unitPositionId,
    FIXTURE.unitId,
    cargo.code,
  );
};

async function main() {
  await waitForReady();

  const status = await get("/system/bootstrap/status");
  if (status.body?.installationMode === "normal") {
    console.log("[bootstrap] el sistema ya está inicializado, no se hace nada.");
    return;
  }

  const payload = {
    ...personPayload(USERS.admin, "Administrador", "Principal", "admin@domain.com", "0990000000", TOKEN_DE_FIRMA.admin),
    // ⚠️ LOS TRES LLEVAN TELEFONO, Y HACE FALTA. Desde que la verificacion del telefono es
    // obligatoria (C8), una persona sembrada sin telefono no puede entrar a nada: el guard del
    // backend la corta en todas las rutas protegidas. Gestor y usuario no lo tenian, y con eso la
    // fixture entera dejaba de servir --71 casos de caracterizacion en rojo.
    //
    // El bootstrap los da por verificados igual que da por verificado su correo y su documento: los
    // crea el instalador, que responde por ellos. Es la misma decision, no una excepcion nueva.
    gestor: personPayload(USERS.gestor, "Gestor", "Procesos", "gestor@domain.com", "0990000001", TOKEN_DE_FIRMA.gestor),
    usuario: personPayload(USERS.usuario, "Usuario", "Prueba", "usuario@domain.com", "0990000002", TOKEN_DE_FIRMA.usuario),
    preconfig: buildPreconfig(status.body?.catalogOptions),
  };

  const res = await post("/system/bootstrap/initialize", { body: payload });
  if (res.status !== 201) {
    throw new Error(`bootstrap/initialize falló: ${res.status} ${JSON.stringify(res.body)}`);
  }
  console.log("[bootstrap] sistema inicializado:", JSON.stringify(res.body.preconfig));

  const { tokenFor } = await import("../lib/auth.mjs");
  await assertFixtureOrgMatches(await tokenFor("admin"));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
