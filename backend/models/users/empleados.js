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

/*POR ELIMINAR EL*/