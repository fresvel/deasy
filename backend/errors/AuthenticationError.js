export default class AuthenticationError extends Error {
  constructor(message = "Credenciales inválidas") {
    super(message);
    this.name = "AuthenticationError";
  }
}

