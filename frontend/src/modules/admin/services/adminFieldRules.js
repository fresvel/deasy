// Las tres reglas declarativas que el backend manda en los metadatos de cada campo
// (`backend/config/sqlTables.js`): `showWhen`, `filterBy` y `pairedWith`.
//
// Viven en un módulo aparte, y no dentro del componente, porque son la parte comprobable: decidir
// si un campo se ve es una función pura de (campo, formulario), y así se prueba sin montar un
// formulario entero. El componente sólo las aplica.

const estaPuesto = (valor) => valor !== undefined && valor !== null && String(valor).trim() !== "";

/**
 * ¿Se pinta este campo con el formulario en este estado?
 *
 * `showWhen` admite cuatro formas, y se evalúan TODAS las que estén declaradas:
 *   { field, isSet: true }         el otro campo tiene valor
 *   { field, equals: "cargo" }     el otro campo vale exactamente eso
 *   { field, anyOf: ["a", "b"] }   el otro campo está en la lista
 *   { field, not: "x" }            el otro campo NO vale eso
 *
 * Sin `showWhen`, el campo se ve siempre. Un `showWhen` sin `field` se ignora en vez de reventar:
 * un metadato mal escrito no debe dejar un formulario en blanco.
 */
export const isFieldVisible = (field, formData = {}) => {
  const regla = field?.showWhen;
  if (!regla?.field) {
    return true;
  }
  const valor = formData[regla.field];
  if (regla.isSet === true && !estaPuesto(valor)) {
    return false;
  }
  if (regla.isSet === false && estaPuesto(valor)) {
    return false;
  }
  if (regla.equals !== undefined && String(valor ?? "") !== String(regla.equals)) {
    return false;
  }
  if (Array.isArray(regla.anyOf) && !regla.anyOf.map(String).includes(String(valor ?? ""))) {
    return false;
  }
  if (regla.not !== undefined && String(valor ?? "") === String(regla.not)) {
    return false;
  }
  return true;
};

/**
 * Los parámetros `filter_*` que acotan el catálogo de una columna ajena.
 *
 * Un padre sin valor NO manda el parámetro: mandarlo vacío pediría «las ciudades de la provincia
 * ''», que son todas, y daría la ilusión de estar filtrando.
 */
export const buildFilterParams = (field, formData = {}) => {
  const params = {};
  for (const [parametro, campoPadre] of Object.entries(field?.filterBy || {})) {
    const valor = formData[campoPadre];
    if (estaPuesto(valor)) {
      params[`filter_${parametro}`] = valor;
    }
  }
  return params;
};

/**
 * Los campos que dependen de `fieldName` y hay que VACIAR cuando cambia.
 *
 * Es la mitad que se olvida: sin esto se elige Ecuador → Manabí → Portoviejo, se cambia el país a
 * España, y Portoviejo se queda puesto. El formulario enseña algo coherente y manda una ciudad que
 * no pertenece a nada. Vacía en cascada, porque cambiar el país invalida provincia Y ciudad.
 */
export const dependentFieldNames = (fieldName, fields = []) => {
  const directos = fields
    .filter((field) => Object.values(field?.filterBy || {}).includes(fieldName))
    .map((field) => field.name);
  return directos.flatMap((nombre) => [nombre, ...dependentFieldNames(nombre, fields)]);
};

/** Un campo que otro ya pinta (la longitud de un `geopoint`) no se pinta por su cuenta. */
export const isPairedAway = (field) => Boolean(field?.pairedWith);
