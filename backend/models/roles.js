import mongoose from "mongoose";

const rolesSchema = new mongoose.Schema({

    user:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Usuario',
        required: true
    },
    permisos:{
        permit:[],
        deny:[],
    },
    funciones:{
        type: [String],
        enum: ["Administrador", "Editor", "Consultor"],
        required: true
    }

})

export const Rol = mongoose.model('Role', rolesSchema);