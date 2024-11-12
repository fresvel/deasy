import { Usuario } from "../../../models/general/usuarios.js";

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