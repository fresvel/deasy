import mongoose from "mongoose";

const informeSchema =new mongoose.Schema(
    {
        code: {
            type: String,
            required: true,
            unique: true
        },
        desc:{
            type: String,
            required: true,
        },
        status:{
            type: String,
            required: true,
            enum:["Inicial","Guardado","Elaborado","Revisado","Aprobado"],
            default: "Inicial"
        },
        /*template: { evaluate with process
            type: mongoose.Schema.Types.ObjectId,
            required: true, //informe con elementos vacíos
            ref: "Template"
        },*/
        content:{
            type: Object,
            required: true
        },
        url:{
            type: String,
            unique: true
        }
        /*era:{
            made:{
                name:{
                    type: String,
                    required: true
                },
                cargo:{
                    type: String,
                    required: true
                },
                date:{
                    type: Date,
                    required: true
                }
            },
            reviewed:{
                name:{
                    type: String,
                    required: true
                },
                cargo:{
                    type: String,
                    required: true
                },
                date:{
                    type: Date,
                    required: true
                }
            },
            aproved:{
                name:{
                    type: String,
                    required: true
                },
                cargo:{
                    type: String,
                    required: true
                },
                date:{
                    type: Date,
                    required: true
                }
            },
        },*/
    }
)


export const Informe=new mongoose.model("Informe",informeSchema);