// Cómo se llama y cómo se valida el documento de identidad de cada país.
//
// POR QUÉ ESTO ES CÓDIGO Y NO UNA TABLA: un validador es un algoritmo, y un algoritmo no cabe en
// una fila. Hasta el 2026-08-29 esto vivía disimulado — `tipos_documento.validacion` no guardaba el
// validador, guardaba una LLAVE a un objeto de funciones. El cambio no es sacarlo de la base: es
// dejar de buscarlo por TIPO y buscarlo por PAÍS, que es de lo que de verdad depende.
//
// Y por eso no hay duplicidad ni explosión de filas: **no hay una entrada por país del mundo, hay
// una entrada por país para el que exista una regla**. Hoy: una. Los otros 231 caen al genérico.
//
// Para añadir un país nuevo se añade su entrada aquí y ya: el catálogo de `paises` no se toca, y
// `instituciones.pais_id` decide cuál de ellas rige el documento nacional de este despliegue.

/** Genérico: lo que se aplica a un país sin regla propia. No inventa un formato que no conocemos. */
export const alfanumerico = (numero) => {
  if (!/^[A-Z0-9]{5,20}$/.test(numero)) {
    return "El documento debe tener entre 5 y 20 caracteres, sólo letras y números.";
  }
  return null;
};

// El dígito verificador de la cédula ecuatoriana: módulo 10 sobre los nueve primeros dígitos, con
// los de posición impar duplicados (y restándoles 9 si pasan de 9).
//
// Se comprueba AQUÍ, gratis y sin red. El servicio externo `validateCedulaEc` sigue existiendo y
// hace otra cosa: preguntarle al registro civil si esa persona existe. Esto caza la errata antes de
// gastar la llamada, y funciona aunque ese servicio esté caído o sin token.
export const cedulaEcuatorianaValida = (numero) => {
  const digitos = String(numero ?? "").replace(/\D/g, "");
  if (!/^\d{10}$/.test(digitos)) return false;
  // Los dos primeros son la provincia: 01..24, más 30 para los emitidos en el exterior.
  const provincia = Number(digitos.slice(0, 2));
  if (!((provincia >= 1 && provincia <= 24) || provincia === 30)) return false;
  // El tercero identifica el tipo: menor que 6 son personas naturales.
  if (Number(digitos[2]) >= 6) return false;

  let suma = 0;
  for (let i = 0; i < 9; i += 1) {
    let valor = Number(digitos[i]);
    if (i % 2 === 0) {
      valor *= 2;
      if (valor > 9) valor -= 9;
    }
    suma += valor;
  }
  const verificador = (10 - (suma % 10)) % 10;
  return verificador === Number(digitos[9]);
};

const cedulaEcuatoriana = (numero) => {
  if (!/^\d{10}$/.test(numero)) {
    return "La cédula ecuatoriana tiene exactamente 10 dígitos.";
  }
  if (!cedulaEcuatorianaValida(numero)) {
    return "La cédula ecuatoriana no es válida: el dígito verificador no cuadra.";
  }
  return null;
};

/** El registro. Clave: ISO-3166 alfa-2. Añadir un país es añadir una línea aquí. */
export const POR_PAIS = {
  EC: { nombre: "Cédula", validador: cedulaEcuatoriana },
};

const PASAPORTE = "pasaporte";

/**
 * El validador que le toca a un documento.
 *
 * EL PASAPORTE ES SIEMPRE ALFANUMÉRICO, mande el país lo que mande: los números de pasaporte no
 * llevan dígito verificador público — los que hay viven en la MRZ, no en el número. Aplicarle el
 * validador del país rechazaría pasaportes ecuatorianos perfectamente válidos por no tener diez
 * dígitos.
 */
export const validadorPara = ({ tipoCode, paisIso } = {}) => {
  if (String(tipoCode ?? "").toLowerCase() === PASAPORTE) {
    return alfanumerico;
  }
  const iso = String(paisIso ?? "").trim().toUpperCase();
  return POR_PAIS[iso]?.validador ?? alfanumerico;
};

/** Cómo llama ese país a su documento de identidad. «Cédula» en Ecuador, «Documento» donde no sepamos. */
export const nombreLocal = (paisIso) => {
  const iso = String(paisIso ?? "").trim().toUpperCase();
  return POR_PAIS[iso]?.nombre ?? "Documento";
};

/**
 * La etiqueta del documento nacional: «Cédula (Ecuador)».
 *
 * Se COMPONE, no se guarda. Hasta el 2026-08-29 estaba escrita en una fila del catálogo, y por eso
 * un despliegue peruano habría enseñado «Cedula (Ecuador)» a sus usuarios peruanos.
 */
export const etiquetaNacional = (paisIso, paisNombre) =>
  paisNombre ? `${nombreLocal(paisIso)} (${paisNombre})` : nombreLocal(paisIso);
