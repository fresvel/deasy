import { describe, expect, it } from "vitest";
import { resolveApiErrorMessage } from "./apiError.js";

describe("resolveApiErrorMessage", () => {
  describe("las dos formas de error que el backend tiene vivas", () => {
    it("forma { ok, error }: usa error, porque ahi va el mensaje humano", () => {
      // verify_email.js:94, reset_password.js:43 — no mandan `message`.
      const error = { response: { data: { ok: false, error: "Código inválido o expirado" } } };
      expect(resolveApiErrorMessage(error)).toBe("Código inválido o expirado");
    });

    it("forma { success, message, error }: usa message y NUNCA el detalle tecnico", () => {
      // fail() de dossier_controler.js:123 — `error` es el volcado de la excepcion.
      const error = {
        response: {
          data: {
            success: false,
            message: "Error al agregar título",
            error: "TypeError: Cannot read properties of undefined (reading 'id')"
          }
        }
      };
      expect(resolveApiErrorMessage(error)).toBe("Error al agregar título");
    });

    it("forma { message } a secas", () => {
      const error = { response: { data: { message: "Certificado no encontrado." } } };
      expect(resolveApiErrorMessage(error)).toBe("Certificado no encontrado.");
    });
  });

  describe("cadena de respaldo", () => {
    it("sin cuerpo util, cae al message del propio error", () => {
      const error = { message: "Network Error" };
      expect(resolveApiErrorMessage(error)).toBe("Network Error");
    });

    it("sin nada aprovechable, usa el fallback dado", () => {
      expect(resolveApiErrorMessage({}, "No se pudo iniciar sesión")).toBe("No se pudo iniciar sesión");
    });

    it("tiene un fallback por defecto", () => {
      expect(resolveApiErrorMessage({})).toBe("Ocurrió un error inesperado.");
    });

    it("aguanta null y undefined sin reventar", () => {
      expect(resolveApiErrorMessage(null, "x")).toBe("x");
      expect(resolveApiErrorMessage(undefined, "x")).toBe("x");
    });
  });

  describe("cadenas vacias o en blanco no cuentan como mensaje", () => {
    it.each([[""], ["   "]])("data.message = %j se ignora y sigue la cadena", (value) => {
      const error = { response: { data: { message: value, error: "Motivo real" } } };
      expect(resolveApiErrorMessage(error)).toBe("Motivo real");
    });

    it("si message y error estan vacios, cae al fallback", () => {
      const error = { response: { data: { message: "", error: "" } }, message: "" };
      expect(resolveApiErrorMessage(error, "respaldo")).toBe("respaldo");
    });
  });

  it("un cuerpo que no es objeto no rompe nada", () => {
    const error = { response: { data: "<html>502 Bad Gateway</html>" }, message: "Request failed" };
    expect(resolveApiErrorMessage(error)).toBe("Request failed");
  });
});
