import GeografiaService from "../../services/system/GeografiaService.js";

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

export const listarCiudades = (req, res) =>
  responder(res, () => geografia.listarCiudades({ provinciaId: req.query.provincia_id }));
