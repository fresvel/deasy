import GeografiaService from "../services/GeografiaService.js";
import InstitucionService from "../services/InstitucionService.js";

// Transporte puro: valida la entrada, llama a UN servicio y traduce a HTTP. Nada de logica.
const geografia = new GeografiaService();

const responder = async (res, fn) => {
  try {
    res.json({ result: "ok", data: await fn() });
  } catch (error) {
    console.error(error);
    res.status(error?.status === 400 ? 400 : 500).json({ message: error.message });
  }
};

export const listarPaises = (req, res) => responder(res, () => geografia.listarPaises());

export const listarProvincias = (req, res) =>
  responder(res, () => geografia.listarProvincias({ pais: req.query.pais, paisId: req.query.pais_id }));

export const listarCantones = (req, res) =>
  responder(res, () => geografia.listarCantones({ provinciaId: req.query.provincia_id }));

export const listarParroquias = (req, res) =>
  responder(res, () => geografia.listarParroquias({ cantonId: req.query.canton_id }));

// El pais NO viene de la peticion: sale de la institucion de esta instalacion, igual que el
// documento nacional. Pedirlo por query dejaria al cliente elegir la nomenclatura.
export const nomenclaturaTerritorial = (req, res) =>
  responder(res, async () => {
    const pais = await new InstitucionService().paisActual();
    return geografia.nomenclatura({ paisId: pais.id });
  });
