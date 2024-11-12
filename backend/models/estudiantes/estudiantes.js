import mongoose from "mongoose";

const estudianteSchema = new mongoose.Schema({
    programas: [{
        programa: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Programa",
        },
        status: {
            type: String,
            enum: ["Alumno", "Alumni", "Retirado", "Desertado", "Egresado", "Reasignado"],//Reasignado cuando se cambia de carrera en la Puce
            default: "Alumno",
        },
        semestre: {
            type: Number,
        },
        inicio:{
            type: Date,
        },
        fin:{
            type: Date,
        }
    }],
    clubes:[{
        club: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Club",
        },
        status: {
            type: String,
            enum: ["Inscrito", "Retirado"],
        },
        fecha_inicio:{
            type: Date,
        },
        fecha_fin:{
            type: Date,
        }
    }],
    funciones:{ //Solicitudes a las que tiene acceso
        type:[mongoose.Schema.Types.ObjectId],
        ref: "Funcion"
    },
    informes:{
        type:[mongoose.Schema.Types.ObjectId],
        ref: "Informe"
    }
})

export const Estudiante=new mongoose.model("Estudiante", estudianteSchema)