// LAS VARIABLES DEL ALMACÉN SE LLAMABAN `MINIO_*` HASTA EL 2026-11-25, y hoy se llaman `ALMACEN_*`
// (frente 29: el almacén dejó de ser MinIO). Un renombre de variables de entorno tiene un fallo
// propio, y es silencioso: la variable vieja se queda en un `.env` o en un secreto, nadie la lee,
// y el código cae a su valor por defecto —otro bucket, otro host, credenciales vacías—. El
// sistema ARRANCA, y el error aparece después y en otro sitio.
//
// Por eso esto corta el arranque: si el entorno trae una `MINIO_*`, es que ese entorno no se
// migró, y se dice cuál renombrar. Se importa por su efecto, lo primero después de dotenv, para
// que corra antes de que ningún módulo lea su configuración.
const PREFIJO_RETIRADO = "MINIO_";
const PREFIJO_VIGENTE = "ALMACEN_";

export const variablesRetiradas = (entorno = process.env) =>
  Object.keys(entorno)
    .filter((nombre) => nombre.startsWith(PREFIJO_RETIRADO))
    .sort();

export const exigirEntornoVigente = (entorno = process.env) => {
  const viejas = variablesRetiradas(entorno);
  if (viejas.length === 0) return;
  const pares = viejas
    .map((nombre) => `  ${nombre} -> ${PREFIJO_VIGENTE}${nombre.slice(PREFIJO_RETIRADO.length)}`)
    .join("\n");
  throw new Error(
    `El entorno trae ${viejas.length} variable(s) con el prefijo retirado ${PREFIJO_RETIRADO}. ` +
      `Desde el 2026-11-25 se llaman ${PREFIJO_VIGENTE}*; sin renombrarlas el sistema usaría sus ` +
      `valores por defecto sin avisar. Renombra en el fichero de entorno o en el secreto:\n${pares}`,
  );
};

// `NODE_TEST_CONTEXT` lo pone el corredor de pruebas de node: ahí se importa la función, no se
// juzga el entorno de quien corre las pruebas.
if (!process.env.NODE_TEST_CONTEXT) exigirEntornoVigente();
