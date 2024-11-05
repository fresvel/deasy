import mongoose from "mongoose";

const perfilSchema = new mongoose.Schema(
    {
        code:{
            type:String,
            required:true,
            unique:true
        },
        type:{
            type: String,
            required:true,
            enum:["Docente", "Estudiante", "Operador"]
        },
        descripcion:{
            type:String,
            required:true,
            unique:true
        },
        nivel:{
            type: Number,
            required:true,
        },
        procesos:{
            type:[String],//Array de los procesos debe ejecutar. Crear base de datos que guarda los procesos
            required:true,
        },
        Informes:{
            type:[String],//Array de los informes debe ejecutar.
            required:true,
        },
    });

    export const Perfil = mongoose.model('Perfil', perfilSchema);