import mongoose from "mongoose";

//Este es el archivo JSON que muestra la plantilla del informe
const templateSchema=new mongoose.Schema(
    {
        code:{
            type:String,
            required:true,
            unique:true
        },
        props:{
            areas:{
                type:[String],
                required:true
            },
            author:{
                type:mongoose.Schema.Types.ObjectId,
                required:true,
                ref:"Docente"
            },
            hash:{
                type:String,
                required:true
            },
            url:{ //Ubicación  dentro del sistema
                type:String,
                required:true
            },
            main:{ //nombre de la función a ejecutar para rendering. Las funciones se almacenan en JS
                type:String,
                required:true
            },
        },
        header:{
            desc:{
                type:String,
                required:true
            },
            periodo:{
                anio:{
                    type:Number,
                },
                ciclo:{
                    type: String,
                }},
            programa:{
                type:mongoose.SchemaTypes.ObjectId,
            },
        },
        content:{
            type:Object,
        },
        footer:{
            era:{
                made:{
                    type: String,
                    required:true
                },
                aproved:{
                    type: String,
                    required:true
                },
                review:{
                    type: String,
                    required:true
                },

            },
        }
    })

export const Template=new mongoose.model("Template",templateSchema);