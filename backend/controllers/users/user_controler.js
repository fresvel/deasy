import { Usuario } from "../../models/users/usuario_model.js";

export const createUser=async(req, res)=>{
    console.log("Creando usuario")
try {
    const newuser= new Usuario(req.body)
    const ret =await newuser.save()

    console.log(ret);
    res.json({result:"ok"})
} catch (error) {

  console.log("Error Creating User")
  console.error(error.message)
    res.status(400).send({
      message: 'Error al crear el usuario',
      error: error.message
    });
}
}

export const getUsers = async(req, res) =>{
  console.log("Buscando todos los usuarios")

  try {
    const users = await Usuario.find()
    if (!users) {
      res.status(404).send({ message: "No se encontraron usuarios" });
      return;
    }

    res.json(users);
  } catch (error) {
    console.log("Error Buscando Usuarios")
    console.error(error.message);
    res.status(500).send({ message: "Error en la petición" });
  }
}