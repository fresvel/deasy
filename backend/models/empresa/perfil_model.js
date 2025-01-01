import mongoose from "mongoose";

const grupos=[  "Rectorado","Dirección de Área", "Coordinación de Área", "Coordinación Académica", 
                "Coordinación de Carrera", "Docencia", "Operativo", "Consejo Escuela",
                "Comité de Calidad"]

const perfilSchema = new mongoose.Schema({
    code:{
        type: String,
        required: true,
        unique: true
    },
    mname:{
        type: String,
        required:true,
    },
    fname:{
        type: String,
        required:true,
    },
    level:{
        type: Number,
        required: true,
    },
    group:{
        type: String,
        required:true,
        enum:grupos
    },
    created:{
        type: Date,
        default: Date.now
    },
    estatus:{
        type: String,
        default: "activo",
        enum:["activo","inactivo"]
    }
});

export const Perfil = mongoose.model("Perfil", perfilSchema);