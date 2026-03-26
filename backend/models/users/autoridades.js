import mongoose from "mongoose";

const autoridadSchema = new mongoose.Schema({
    usuario: {type: mongoose.Schema.Types.ObjectId,ref: "Usuario",required: true},
    cargo: {type: String,required: true},
    departamento: {type: String,required: true},
    tipo:{type:String, enum:["Docente", "Administrativo", "Estudiante"]}
});