import mongoose from "mongoose";

const validarEmail = {
    validator: function (v) {
      // Validación básica de formato de email
      return /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(v);
    },
    message: props => `${props.value} No es un correo electrónico válido.`
    }
const validarCorreo={
    validator: async function (v) {
        if (v) {
            // Validación básica de formato de email
            const isValidFormat = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(v);
            if (!isValidFormat) {
              return false; // Si el formato no es válido
            }
            
            // Verifica si ya existe un documento con el mismo correo
            const existingUser = await this.constructor.findOne({ correo: v });
            return !existingUser; // Debe ser único si ya existe
          }
          return true; // No se valida si el valor no está presente
    },
    message: props => `${props.value} no es un correo electrónico institucional válido o ya está en uso.`
  }

const roles={ type:String, enum:["Docente", "Administrativo", "Estudiante", "Autoridad","Coordinador de Área", "Coordinador de Carrera"]}

const userSchema =new mongoose.Schema({
    cedula:{type:String, required:true, unique:true},
    password:{type:String, required:true},
    nombre:{type:String, required:true},
    apellido:{ type:String, required:true},
    email:{ type:String, required:true, unique:true, validate: validarEmail},
    correo:{ type: String, validate: validarCorreo},
    direccion:{type:String},
    whatsapp: {type: String},
    verify:{
        whatsapp:{type: Boolean,default: false},
        email:{type: Boolean, default: false}
    },
    status:{type: String, enum: ["Inactivo", "Activo", "Verificado", "Reportado"], default: "Inactivo"},
    roles:[roles]
});

export const Usuario = mongoose.model('Usuario', userSchema);