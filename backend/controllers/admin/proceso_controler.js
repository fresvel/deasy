import { Proceso } from "../../models/informes/proceso_model.js";


export const createProceso = async (req, res) => {
    console.log("Creando Nuevo Proceso");
    try {
        const newproceso = new Proceso(req.body);
        const ret = await newproceso.save();
        console.log(ret);
        res.json({ result: "ok" });
    } catch (error) {
        console.log("Error Creating Proceso");
        console.error(error.message)
        res.status(400).send({
            message: 'Error al crear el proceso',
            error: error.message
        });
    }
}