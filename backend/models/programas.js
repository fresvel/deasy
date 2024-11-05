import mongoose from "mongoose";

const programaSchema = new mongoose.Schema(
    {
        code:{
            type: String,
            required: true,
        },
        name:{
            type:String,
            required:true,
            unique:true
        },
        facultad:{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Facultad'
        },
        nivel:{
            type: String,
            required:true,
            enum:["Grado", "Maestría", "Doctorado","Técnico", "Tecnológico"]
        },
        coordinador:{
            type: mongoose.Schema.Types.ObjectId,
            required:true,
            ref:"Docente",
        },
        docentes: { //Docentes a cargo
            type: [mongoose.Schema.Types.ObjectId],
            ref: "Docente",
        },
        consejo:{
            docentes:[
                {
                    docente:{
                        type: mongoose.Schema.Types.ObjectId,
                        ref: "Docente"
                    },
                    mención:{
                        type:String,
                    }
                }
            ],
            estudiantes:[
                {
                    estudiante:{
                        type: mongoose.Schema.Types.ObjectId,
                        ref: "Estudiante"
                    },
                    mención:{
                        type:String,
                    }
                }
            ],
        },
        calidad:{
            docentes:[
                {
                    docente:{
                        type: mongoose.Schema.Types.ObjectId,
                        ref: "Docente"
                    },
                    mención:{
                        type:String,
                    }
                }
            ],
            estudiantes:[
                {
                    estudiante:{
                        type: mongoose.Schema.Types.ObjectId,
                        ref: "Estudiante"
                    },
                    mención:{
                        type:String,
                    }
                }
            ],
        }
    });

export const Programa=new mongoose.model('Programa', programaSchema);