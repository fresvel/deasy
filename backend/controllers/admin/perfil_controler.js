import { Perfil } from "../../models/empresa/perfil_model.js";


export const createPerfil = async (req, res) => {
    console.log("Creando Nuevo Perfil");
    try {
        const newperfil= new Perfil(req.body);
        const ret = await newperfil.save();
        console.log(ret);
        res.json({ result: "ok" });
    } catch (error) {
        console.log("Error Creating Perfil");
        console.error(error.message);
        res.status(400).send({
            message: 'Error al crear el Perfil',
            error: error.message
        });
    }
}