import mongoose from "mongoose";

const tareaSchema = new mongoose.Schema({
    code:{ //process+program+year+period
        type: String,
        required: true,
        unique: true
    },
    fecha_inicio:{
        type: Date,
        default: Date.now
    },
    fecha_limite:{
        type: Date,
        required: true,
    },
    usuario:{ 
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Usuario'
    },
    /**
     * Los Usuarios se determinan desde los perfiles del proceso.
     * Para cada usuario encontrado por cada perfil se crea una nueva tarea
     * Validar que un usuario solo reciba una tarea.
     */
    estatus:{
        type: String,
        default: "Pendiente",
        enum:["Pendiente","Iniciado","Finalizado"]
    },
    program:{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Programa",
        required:true
    },
    year:{
        type:Number,
        required:true
    },
    period:{
        type: String,
        required:true,
        enum:["S1","S2"]
    },
    process:{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Proceso",
        required: true
    },
    content:{
        type: Object,
        required: true,
        default:null
    },
    informe:{
        status:{
            type: String,
            required: true,
            enum:["Desierto","Inicial","Guardado","Elaborado","Revisado","Aprobado","Revocado"],
            default: "Inicial"
        },
        url:{ //Apunta a carpeta si es de varios documentos
            type: String,
            default: ""
        }
    },
    /**
     * Un usuario puede inicar un informe antes de su solicitud,
     * para esto se debe crear la tarea.
     * se debe validar que no se duplique cuando se genera la crearción 
     * de tareas por lote. 
     */
});

export const Tarea = mongoose.model('Tarea', tareaSchema);