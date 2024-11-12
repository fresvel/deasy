import mongoos from "mongoose";



/**
 * Docente -- Perfil General
 * Administrativo -- Perfil General + Perfil por Departamento
 * Autoridad -- Perfiles por Departamento
 * Estudiante -- Perfil General 
 * Prospecto -- Perfil General
 */


const rolSchema= new mongoos.Schema({
    relacionLaboral: {
        tipo: { type: String, enum: ['Docente', 'Administrativo', 'Autoridad'] },
        dedicacion: { type: String, enum:["Tiempo Completo","Tiempo Parcial"] },
        contrato:{ type: String, required: true, enum:["Relación de Dependencia","Servicios Profesionales"]},
        departamento: {type: mongoose.Schema.Types.ObjectId, ref: "Departamento" },
        cargo: { type: String}, //Crear cargos en esquema
        escalafon:{type: String,enum:["Honorario","Ocasional","Invitado", "Emérito", "Axiliar 1", "Auxiliar 2", "Agregado 1", "Agregado 2", "Agregado 3", "Principal 1", "Principal 2", "Principal 3"]},  
      },

  // Información de roles específicos
  roles: {
    estudiante: {
      programa: { type: String },
      matricula: { type: String },
      fechaIngreso: { type: Date }
    },
    docente: {
      catedras: [String],
      categoria: {
        type: String,
        enum: ["Honorario", "Ocasional", "Principal", "Auxiliar"]
      },
      dedicacion: { type: String }
    },
    administrativo: {
      cargo: { type: String },
      departamento: { type: String }
    },
    autoridad: {
      cargo: { type: String },
      gestion: { type: String }
    }
  }
});