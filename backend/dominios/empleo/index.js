// LA PUERTA DEL DOMINIO `empleo` — Y ESTÁ VACÍA A PROPÓSITO.
//
// El dominio existe en el modelo con sus **8 tablas** —`vacancies`, `vacancy_visibility`, `offers`,
// `aplications`, `contracts`, `contract_origins`, `contract_origin_recruitment`,
// `contract_origin_renewal`, todas en el nivel 7— y **no tiene una sola línea de código propia**: hoy
// sólo las escribe el editor genérico de `/admin`, que es un transversal declarado.
//
// ⚠️ LA CARPETA ESTÁ RESERVADA POR DECISIÓN DEL DUEÑO, el 2026-10-07: *«Si se tendrá módulo de
// empleo»*. Es el sitio al que ir cuando se construya —convocatorias, ofertas, postulaciones,
// contratos—, y por eso nace antes que su contenido.
//
// ⚠️ Y ESTO NO REPITE EL DEFECTO DE LOS 15 «MÓDULOS» RETIRADOS, aunque se parezca. Allí el problema
// era que cuatro de los quince **no eran dueños de ni un fichero y nunca lo iban a ser**: una
// clasificación inventada sobre código que no existía. Aquí la carpeta está vacía porque **el trabajo
// está por hacer y el dueño confirma que se hará**. Una carpeta vacía por reserva declarada es una
// promesa; una por clasificación inventada es un error. No son lo mismo.
//
// Cuando se construya, la forma es la de `dominios/chat/`: `routes/`, `controllers/`, `services/`,
// `datos/` y, si alguna lectura cruza, `datos/consulta/`. Y lo que salga de aquí se exporta por este
// fichero, que es lo único que otro dominio puede importar.
export {};
