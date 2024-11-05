import mongoose from "mongoose";

const coleccionSchema = new mongoose.Schema({
    nombre:{
        type: String,
        required: true,
        unique: true
    },
    author:{
        deny:[
            //campos deny para el autor
        ],
        allow:[
            //campos permitidos para el autor
        ],
        users:{grupos:[], others:[]}
    },
    review:{
        deny:{

        },
        allow:{

        },
        users:{grupos:[], others:[]}
    },
    certify:{
        deny:{

        },
        allow:{

        },
        users:{grupos:[], others:[]}
    }
    
});

export const Coleccion = mongoose.model('Colecciones', coleccionSchema);