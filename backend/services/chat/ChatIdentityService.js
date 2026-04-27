import UserRepository from "../auth/UserRepository.js";

export default class ChatIdentityService {
  constructor({ userRepository = new UserRepository() } = {}) {
    this.userRepository = userRepository;
  }

  async resolveAuthenticatedPerson(req) {
    const userId = Number(req?.user?.uid || 0);
    if (!userId) {
      const error = new Error("Usuario autenticado no válido.");
      error.status = 401;
      throw error;
    }

    const person = await this.userRepository.findById(userId);
    if (!person) {
      const error = new Error("Persona autenticada no encontrada.");
      error.status = 404;
      throw error;
    }

    return {
      userId,
      personId: Number(person.id),
      person
    };
  }
}
