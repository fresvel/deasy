import mongoose from "mongoose";



const tituloSchema = new mongoose.Schema({
    titulo:{type: String,},
    ies:{type: String,},
    nivel:{type: String,required: true,enum:["Técnico","Tecnólogo","Grado", "Maestría", "Maestría Tecnológica", "Diplomado","Doctorado", "Posdoctorado"]},
    sreg:{type: String},
    campo_amplio:{type: String},
    tipo:{type: String, required: true,
        enum:["Presencial","Semipresencial","Virtual", "Híbrido"]
    },
    pais:{type: String, default:"Ecuador"},
    sera:{type: String, enum: ["Enviado", "Revisado", "Aprobado"], default: "Enviado"
    },
    url_documento:{type: String}
})

const experienciaSchema = new mongoose.Schema({

    institucion:{type: String,},
    fecha_inicio:{type: Date,},
    fecha_fin:{type: Date,},
    funcion_catedra:{type: [String]},
    tipo:{type: String,enum:["Docencia", "Profesional"]},
    sera:{type: String,enum: ["Enviado", "Revisado", "Aprobado"]},
    url_documento:{type: String}
});

const referenciaSchema = new mongoose.Schema({
    nombre:{type: String},
    cargo_parentesco:{type: String, require:function(){return this.tipo!=="personal"}, default:""},
    email:{type: String,
            validate: {
                validator: function (v) {
                  return /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(v);
                },
                message: props => `${props.value} no es un correo electrónico válido.`
              }
    },
    telefono:{type: String},
    institution:{type: String, required:function(){return this.tipo === "laboral"}, default:""},
    tipo: {type: String, enum: ["laboral", "personal", "familiar"]},
    url_documento:{type: String}
});

const formacionSchema = new mongoose.Schema({ 
    tema:{type: String},
    institution:{type: String},
    horas:{type: Number},
    fecha_inicio:{type: Date},
    fecha_fin:{type: Date},
    tipo:{type: String, enum: ["Docente","Profesional"]},
    rol: {type: String, enum: ["Asistencia","Instructor", "Aprobación"]},
    pais:{type: String, default:"Ecuador"},
    sera:{type: String, enum: ["Enviado", "Revisado", "Aprobado"]},
    url_documento:{type: String}
});

const certificacionSchema = new mongoose.Schema({
    titulo:{type: String},
    institution:{type: String},
    horas:{type: Number},
    fecha:{type: Date},
    tipo: {type: String, enum: ["Nacional","Internacional"]},
    sera:{type: String, enum: ["Enviado", "Revisado", "Aprobado"]},
    url_documento:{type: String}
});

const articuloSchema= new mongoose.Schema({
    titulo:{type:String},
    base_indexada:{type: String},
    revista:{type: String},
    doi:{type: String},
    issn:{type: String},
    sjr:{type: Number},
    fecha:{type: Date},
    pais:{type: String, default:"Ecuador"},
    estado:{type: String, enum: ["Aceptado", "Publicado"]},
    rol:{type: String, enum: ["Autor", "Coautor", "Revisor"]},
    sera:{type: String, enum: ["Enviado", "Revisado", "Aprobado"]},
    url_documento:{type: String}
})

const libroSchema = new mongoose.Schema({
    titulo:{type:String},
    editorial:{ type: String},
    isbn:{type: String},
    isnn:{type: String},
    año:{type: Number},
    pais:{type: String, default:"Ecuador"},
    tipo: {type: String, enum: ["Libro", "Capítulo"]},
    sera:{type: String, enum: ["Enviado", "Revisado", "Aprobado"]},
    url_documento:{type: String}
})

const ponenciaSchema = new mongoose.Schema({
    titulo:{type: String},
    evento:{type: String},
    año:{type: Number},
    pais:{type: String, default:"Ecuador"},
    sera:{type: String,enum: ["Enviado", "Revisado", "Aprobado"]},
    url_documento:{type: String}
});

const tesisSchema = new mongoose.Schema({
    ies:{type: String},
    tema:{type: String},
    programa:{type: String},
    nivel:{type: String, enum:["Técnico","Tecnólogo","Grado", "Maestría", "Diplomado","Doctorado", "Posdoctorado"]},
    año:{type: Number},
    rol:{ type: String, enum:["Revisor","Asesor"]},
    pais:{type: String, default:"Ecuador"},
    sera:{type: String, enum: ["Enviado", "Revisado", "Aprobado"]},
    url_documento:{type: String}
})

const proyectoSchema = new mongoose.Schema({
    tema:{type: String},
    institucion:{type: String},
    inicio:{type: Date},
    fin:{type: Date},
    avance:{type: Number},
    presupuesto:{type: Number},
    pais:{type: String, default:"Ecuador"},
    tipo:{type: String, enum:["Investigación", "Vinculación"]},
    programa_grupo:{type: String},
    sera:{type: String, enum: ["Enviado", "Revisado", "Aprobado"]},
    url_documento:{type: String}
})


const dossierSchema=new mongoose.Schema({
    
    usuario:{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Usuario",
        default: null
    },
    cedula:{
        type: String,
        index: true,
        sparse: true
    },

    titulos:[tituloSchema],
    experiencia:[experienciaSchema],
    referencias:[referenciaSchema],
    formacion:[formacionSchema],
    certificaciones:[certificacionSchema],

    investigacion:{
        articulos:[articuloSchema],
        libros:[libroSchema],
        ponencias:[ponenciaSchema],
        tesis:[tesisSchema],
        proyectos:[proyectoSchema],
    },
})

export const Dossier=new mongoose.model("Dossier", dossierSchema)