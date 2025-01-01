import {Program} from "../../models/empresa/programa_model.js"

export const createProgram =async(req, res)=>{
    console.log("Creando Nuevo Programa")
    try {
        const newprogram =new Program(req.body)
        const ret =await newprogram.save();
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

export const getPrograms = async(req, res) => {
    console.log("Buscando todos los programas")

    try {
        const program = await Program.find()
        if (!program) {
            return res.status(404).json({ message: "Ningún programa no encontrado" });
        }
        console.log(program)
        res.json(program);
    } catch (error) {
        console.log("Error Buscando Programa por ID")
        res.status(500).json({ message: error.message });
    }
}