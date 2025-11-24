import { Usuario } from "../../models/users/usuario_model.js";

export default class UserRepository {
  async findByCedulaOrEmail({ cedula, email }) {
    const filters = [];

    if (cedula) {
      filters.push({ cedula });
    }

    if (email) {
      filters.push({ email });
    }

    if (!filters.length) {
      return null;
    }

    return Usuario.findOne({ $or: filters });
  }

  toPublicUser(userDoc) {
    if (!userDoc) {
      return null;
    }

    return {
      _id: userDoc._id,
      cedula: userDoc.cedula,
      nombre: userDoc.nombre,
      apellido: userDoc.apellido,
      email: userDoc.email,
      whatsapp: userDoc.whatsapp,
      direccion: userDoc.direccion,
      pais: userDoc.pais
    };
  }
}

