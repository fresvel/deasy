import { configDotenv } from "dotenv";
import mongoose from "mongoose";

const materiasSchema=new mongoose.Schema({
    nrc:{
        type:String,
        required:true,
        unique:true
    },
    docente:{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Usuario",
        required: true
    },
    code:{ // enviar a otra tabla
        id:{
            type: String,
            required: true,
        },
        su:{
            type: String,
            required: true
        },
        pu:{
            type: String,
            required: true
        }
    },
    name:{
        type: String,
        required: true
    },
    
});

export const Materia = mongoose.model("Materia", materiasSchema);