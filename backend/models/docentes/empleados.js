import mongoose from "mongoose";

const empleadoSchema=new mongoose.Schema({
    
    usuario:{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Usuario",
        required: true
    },

    relacion:{
        estado:{
            type: String,
            required: true,
            enum:["Postulante","Contratado","Desvinculado", "Licenciado"]
        },

        dedicacion:{ //requerido si es diferente de postulante
            type: String,
            required: true,
            enum:["Tiempo Completo","Tiempo Parcial"]
        },
        
        contrato:{
            type: String,
            required: true,
            enum:["Relación de Dependencia","Servicios Profesionales"]
        },
        gestion:{
            area:{
                type: String,
                required: true,
                enum:["Academia","Investigación","Tecnología","Recursos Humanos","Comunicaciones","Gobierno"]
            },
            cargo:{ //Validar enum en funcion de area
                type: String,
            },
            funciones:{ //Solicitudes a las que tiene acceso
                type:[mongoose.Schema.Types.ObjectId],
                ref: "Funcion"
            },
            informes:{
                type:[mongoose.Schema.Types.ObjectId],
                ref: "Informe"
            }
        },

        docencia:{
            programa:{
                type: mongoose.Schema.Types.ObjectId,
                ref: "Programa"
            },
            categoria:{
                type: String,
                enum:["Honorario","Ocasional","Invitado", "Emérito", "Axiliar 1", "Auxiliar 2", "Agregado 1", "Agregado 2", "Agregado 3", "Principal 1", "Principal 2", "Principal 3"]
            },
            funciones:{ //Solicitudes a las que tiene acceso
                type:[mongoose.Schema.Types.ObjectId],
                ref: "Funcion"
            },
            informes:{
                type:[mongoose.Schema.Types.ObjectId],
                ref: "Informe"
            }
        },

    }
})

export const Empleado=new mongoose.model("Empleado", empleadoSchema)