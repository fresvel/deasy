import { Area } from "../../models/empresa/area_model.js";

export const createArea =async(req, res)=>{
    console.log("Creando Nueva Área")
    try {
        const newarea =new Area(req.body)
        const ret =await newarea.save();
        console.log(ret);
        res.json({result:"ok"})
    } catch (error) {
        console.log("Error Creating Program")
        console.error(error.message)
        res.status(400).send({
            message: 'Error al crear el programa',
            error: error.message
        });
    }
}


export const getAreas = async(req, res)=>{
    console.log("Buscando Todas las áreas")
    try {
        const areas = await Area.find()
        if (!areas) {
            return res.status(404).send({ message: 'No se encontraron áreas' });
        }
        res.json(areas);
    } catch (error) {
        console.error("Error al buscar ��reas", error);
        res.status(500).send({ message: 'Error en el servidor' });
    }
}
