import {Facultad} from "../../models/empresa/facultad_model.js"

export const createFacultad =async(req, res)=>{
    console.log("Creando Nueva Facultad")
    try {
        const newfaculty =new Facultad(req.body)
        const ret =await newfaculty.save();
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
