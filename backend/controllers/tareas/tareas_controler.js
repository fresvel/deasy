import { Tarea } from "../../models/empresa/tareas_model.js";
import { Proceso } from "../../models/informes/proceso_model.js";
import { Program } from "../../models/empresa/programa_model.js";
import { Usuario } from "../../models/users/usuario_model.js";


export const createTarea = async (req, res) => { // Cuando el autor crear la tarea antes de su asignación
    console.log("Creando Nueva Tarea");
    try {

        const proceso = await Proceso.findById(req.body.process)
        if (!proceso) {
            return res.status(404).json({ message: "Proceso no encontrado" });
        }
        req.body.code =proceso.code.replace(/_/g, "")+req.body.year+req.body.period;
        console.log(req.body.code);

        const newTarea = new Tarea(req.body);
        const ret = await newTarea.save();
        console.log(ret);
        res.json({ result: ret });
    } catch (error) {
        console.log("Error Creating Tarea");
        console.error(error.message);
        res.status(400).send({
            message: 'Error al crear la tarea',
            error: error.message
        });
    }
}

export const createLoteTareas = async (req, res) => { // Cuando el jefe departmental asigna las tareas
    console.log("Creando Lote de Tareas");
    try {
        const tareas = req.body.tareas;
        const ret = await Tarea.insertMany(tareas);
        console.log(ret);
        res.json({ result: "ok" });
    } catch (error) {
        console.log("Error Creating Lote de Tareas");
        console.error(error.message);
    }
}


export const getuserTarea = async (req, res) => {
    console.log("Buscando Tareas por parámetros");
    try {
        const usuario = await Usuario.find({cedula: req.body.usuario})
        if (!usuario||usuario.length ===0) {
            return res.status(404).json({ message: "Usuario no encontrado" });
        } 
        const programa =await Program.find({code: "E055"})
        if (!programa||programa.length ===0) {
            return res.status(404).json({ message: "Programa no encontrado" });
        }
        const process=await Proceso.find({code: req.body.process});
        if (!process||process.length === 0) {
            return res.status(404).json({ message: "Proceso no encontrado" });
        }

        console.log(usuario[0].id)


        const tareas = await Tarea.find({
            program: programa[0]._id,
            process: process[0]._id,
            usuario: usuario[0]._id,
            year:req.body.year,
            period:req.body.period,
        });

        if (!tareas) {
            return res.status(404).json({ message: "Ninguna tarea encontrada" });
        }
        res.json(tareas);
        
            
    } catch (error) {
        console.log("Error Buscando Tareas por Usuario");
        console.error(error.message);
        res.status(500).json({ message: error.message });
    }

};

export const getTareas = (req, res) => {
    console.log("Buscando Todas las Tareas");

    Tarea.find()
       .then(tareas => res.json(tareas))
       .catch(error => res.status(400).json({ message: "Error al buscar tareas", error }));
}


export const getTareaspendientes = async(req, res) => {
    console.log("Buscando Tareas Pendientes");
    
    const users = await Usuario.find({cedula: req.body.usuario})
    if (!users||users.length ===0) {
        return res.status(404).json({ message: "Usuario no encontrado" });
    }
    const tareas = await Usuario.find({
        usuario: users[0]._id,
        estatus: "Pendiente",
    });
}