const BASE_URL = process.env.WEBSERVICESEC_BASE_URL?.replace(/\/$/, "") || "https://webservices.ec/api";
const TOKEN = process.env.WEBSERVICESEC_TOKEN;

const buildHeaders = () => ({
  Authorization: `Bearer ${TOKEN}`,
  Accept: "application/json"
});

const ensureToken = () => {
  if (!TOKEN) {
    const error = new Error("No se ha configurado la variable WEBSERVICESEC_TOKEN");
    error.status = 500;
    throw error;
  }
};

const request = async (endpoint) => {
  ensureToken();
  const url = `${BASE_URL}${endpoint}`;

  let response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: buildHeaders()
    });
  } catch (error) {
    const err = new Error("No se pudo conectar con WebServices.ec");
    err.status = 502;
    err.cause = error;
    throw err;
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch (error) {
    const err = new Error("Respuesta inválida de WebServices.ec");
    err.status = 502;
    err.cause = error;
    throw err;
  }

  return { response, payload };
};

export const validateCedulaEc = async (cedula) => {
  const { response, payload } = await request(`/cedula/${cedula}`);

  const cedulaData = payload?.data?.response;

  if (!response.ok || !cedulaData) {
    return {
      valid: false,
      message: payload?.message || "La cédula no se encuentra registrada",
      data: null,
      raw: payload
    };
  }

  return {
    valid: true,
    message: "Cédula validada correctamente",
    data: {
      identificacion: cedulaData.identificacion,
      nombreCompleto: cedulaData.nombreCompleto,
      nombres: cedulaData.nombres,
      apellidos: cedulaData.apellidos,
      fechaDefuncion: cedulaData.fechaDefuncion
    },
    raw: payload
  };
};

export const validateWhatsappEc = async (fullNumber) => {
  const { response, payload } = await request(`/checkwhatsapp/${fullNumber}`);

  const status = payload?.data?.status;

  if (!response.ok || !status) {
    return {
      valid: false,
      message: payload?.message || "No fue posible validar el número",
      status: status || "unknown",
      raw: payload
    };
  }

  const isAvailable = status.toLowerCase() === "available";

  return {
    valid: isAvailable,
    message: isAvailable ? "El número tiene WhatsApp activo" : `Estado reportado: ${status}`,
    status,
    raw: payload
  };
};

