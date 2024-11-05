import mongoose from "mongoose";

const informe =new mongoose.Schema(
    {
        code: {
            type: String,
            required: true,
            unique: true
        },
        template: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: "Template"
        },
        content:{
            type: Object,
            required: true
        },
        props:{
            owners:{
                type: [mongoose.Schema.Types.ObjectId],
                ref: "User"
            },
            author:{
                type: mongoose.Schema.Types.ObjectId,
                required: true,
                ref: "User"
            },
            programas:{
                type: [mongoose.Schema.Types.ObjectId],
                ref: "Programa",
                required:true
            },
            period:{
                year:{
                    type:Number,
                    required:true
                },
                ciclo:{
                    type: String,
                    required:true,
                    enum:["Primer Periodo Ordinario","Segundo Periodo Ordinario"]
                }},
            refers:{
                type:[mongoose.Schema.Types.ObjectId],
                ref: "Informe"
            },
            url:{
                type: String,
                required: true,
                unique: true
            }
        },
        era:{
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
        },
    }
)
