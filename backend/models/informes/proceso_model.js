import mongoose from "mongoose";

const procesSchema = new mongoose.Schema({
    code:{ //Codigo creardo uniendo area_perfil_nombre de informe
        type: String,
        required: true,
        unique: true
    },
    name:{
        type: String,
        required: true,
    },
    desc:{
        type: String,
        required: true,
    },
    area:{ //Rendering area in menu of frontend
        type: mongoose.Schema.Types.ObjectId,
        ref: "Area",
        required: true
    },
    perfil:{ //Rendering area in menu of frontend
        type: mongoose.Schema.Types.ObjectId,
        ref: "Perfil",
        required: true
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
})

export const Proceso = mongoose.model("Proceso", procesSchema);