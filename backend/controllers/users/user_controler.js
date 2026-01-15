import path from "path";
import fs from "fs-extra";
import whatsappBot from "../../services/whatsapp/WhatsAppBot.js";
import UserRepository from "../../services/auth/UserRepository.js";

const userRepository = new UserRepository();

export const createUser = async (req, res) => {
  console.log("Creando usuario");
  try {
    const userPayload = {
      cedula: req.body.cedula,
      email: req.body.email,
      password: req.body.password,
      nombre: req.body.nombre,
      apellido: req.body.apellido,
      whatsapp: req.body.whatsapp,
      direccion: req.body.direccion,
      pais: req.body.pais,
      status: req.body.status,
      verify_email: req.body.verify?.email,
      verify_whatsapp: req.body.verify?.whatsapp,
      photo_url: req.body.photoUrl ?? req.body.photo_url ?? null
    };

    const createdUser = await userRepository.create(userPayload);
    console.log(`Usuario creado en MariaDB con id ${createdUser.id}`);

    if (whatsappBot.isReady && createdUser.whatsapp) {
      try {
        const userName = `${createdUser.nombre} ${createdUser.apellido}`;
        await whatsappBot.sendWelcomeMessage(createdUser.whatsapp, userName);
        console.log(`Mensaje de bienvenida enviado a ${createdUser.whatsapp}`);
      } catch (error) {
        console.log(`No se pudo enviar mensaje de WhatsApp: ${error.message}`);
      }
    }

    res.json({ result: "ok", user: userRepository.toPublicUser(createdUser) });
  } catch (error) {
    console.log("Error Creating User");
    console.error(error);

    if (error?.code === "ER_DUP_ENTRY") {
      return res.status(409).send({
        message: "La cédula o el correo ya existen",
        error: error.message
      });
    }

    res.status(400).send({
      message: "Error al crear el usuario",
      error: error.message
    });
  }
};

export const getUsers = async (req, res) => {
  console.log("Buscando todos los usuarios");

  try {
    const term = req.query?.search ?? "";
    const limit = req.query?.limit ?? 20;
    const status = req.query?.status ?? null;
    const users = await userRepository.search(term, limit, status);
    res.json(users.map((user) => userRepository.toPublicUser(user)));
  } catch (error) {
    console.log("Error Buscando Usuarios");
    console.error(error.message);
    res.status(500).send({ message: "Error en la petición" });
  }
};

export const updateUserPhoto = async (req, res) => {
  const { cedula } = req.params;
  const file = req.file;

  if (!file) {
    return res.status(400).send({ message: "Debe adjuntar la foto en el campo 'photo'." });
  }

  try {
    const existingUser = await userRepository.findByCedulaOrEmail({ cedula });
    if (!existingUser) {
      await fs.remove(file.path).catch(() => {});
      return res.status(404).send({ message: "Usuario no encontrado" });
    }

    const relativePath = path.relative(process.cwd(), file.path).replace(/\\/g, "/");
    const normalizedPath = relativePath.startsWith("uploads/") ? relativePath : `uploads/${relativePath}`;

    const updatedUser = await userRepository.updatePhotoByCedula(cedula, normalizedPath);

    const previousPath = existingUser.photo_url;
    if (previousPath && !previousPath.startsWith("data:")) {
      const absolutePrev = path.resolve(process.cwd(), previousPath.replace(/^\/+/, ""));
      if (await fs.pathExists(absolutePrev)) {
        await fs.remove(absolutePrev).catch(() => {});
      }
    }

    res.json({ result: "ok", user: updatedUser });
  } catch (error) {
    await fs.remove(file.path).catch(() => {});
    console.error("Error actualizando foto de usuario", error);
    res.status(500).send({ message: "Error al actualizar la foto", error: error.message });
  }
};
