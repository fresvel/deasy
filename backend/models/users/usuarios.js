import mongoose from "mongoose";

const userSchema =new mongoose.Schema({
    password:{
        type:String,
        required:true
    },
    cedula:{
        type:String,
        required:true,
        unique:true
    },
    nombre:{
        type:String,
        required:true,
    },
    apellido:{
        type:String,
        required:true,
    },
    email:{
        type:String,
        required:true,
        unique:true,
        validate: {
            validator: function (v) {
              // Validación básica de formato de email
              return /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(v);
            },
            message: props => `${props.value} no es un correo electrónico válido.`
          }
    },
    correo:{ //Institucional
        type: String,
        validate: {
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
    },
    direccion:{                       // tomar coordenada de google 
        type:String,
    },
    whatsapp: {
        type: String,
    },
    status: {
        type: String,
        required: true,
        enum: ["Activo", "Inactivo", "Verificado"], //Pasa a verificado cuando TTHH lo contrata o si se matricula. Se tiene copia de cédula
        default: "Inactivo",                        //Se activa via whatsapp o correo electrónico
    },
});


export const Usuario = mongoose.model('Usuario', userSchema);