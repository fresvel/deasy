import mongoose from "mongoose";

// Sub-schema para metadata de un documento almacenado en MinIO
const soporteDocumentalSchema = new mongoose.Schema({
    bucket:        { type: String },
    object_key:    { type: String },
    etag:          { type: String },
    mime_type:     { type: String },
    original_name: { type: String },
    uploaded_at:   { type: Date, default: Date.now }
}, { _id: false });

// ─── CAMBIO DE COMPATIBILIDAD ────────────────────────────────────────────────
// El campo `tipo` originalmente representaba la modalidad de cursado
// (Presencial, Semipresencial, Virtual, Híbrido). Se mantiene como OPCIONAL
// para no romper el frontend existente; el campo ya no es required.
// Se agrega `registro_tipo` para el dato real de SENESCYT (Nacional/Extranjero).
// ─────────────────────────────────────────────────────────────────────────────
const tituloSchema = new mongoose.Schema({
    titulo:         { type: String },
    ies:            { type: String },
    nivel:          { type: String, required: true, enum: ["Técnico","Tecnólogo","Grado","Maestría","Maestría Tecnológica","Diplomado","Doctorado","Posdoctorado"] },
    sreg:           { type: String },           // Número de registro SENESCYT
    campo_amplio:   { type: String },
    fecha_registro: { type: Date },             // Fecha de registro en SENESCYT
    // Modalidad de cursado (carga manual). Ahora opcional para permitir imports de SENESCYT.
    tipo:           { type: String, enum: ["Presencial","Semipresencial","Virtual","Híbrido"] },
    // Tipo de registro según SENESCYT: Nacional o Extranjero
    registro_tipo:  { type: String, enum: ["Nacional","Extranjero"] },
    pais:           { type: String, default: "Ecuador" },
    sera:           { type: String, enum: ["Enviado","Revisado","Aprobado"], default: "Enviado" },

    // Soporte documental por título
    soporte_senescyt: { type: soporteDocumentalSchema, default: null },  // PDF del certificado SENESCYT
    soporte_adicional: { type: soporteDocumentalSchema, default: null }, // PDF adicional de respaldo

    // Auditoría de importación
    source:           { type: String, enum: ["manual","senescyt_import"], default: "manual" },
    imported_at:      { type: Date },
    import_warnings:  [{ type: String }]
})

const experienciaSchema = new mongoose.Schema({

    institucion:{type: String,},
    fecha_inicio:{type: Date,},
    fecha_fin:{type: Date,}, // Calcular años
    funcion_catedra:{type: [String]},
    tipo:{type: String,enum:["Docencia", "Profesional"]},
    sera:{type: String,enum: ["Enviado", "Revisado", "Aprobado"]},
});

const referenciaSchema = new mongoose.Schema({
    nombre:{type: String},
    cargo_parentesco:{type: String, require:function(){return this.tipo!=="personal"}, default:""}, // cargo o parentezco
    email:{type: String,
            validate: {
                validator: function (v) {
                  // Validación básica de formato de email
                  return /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(v);
                },
                message: props => `${props.value} no es un correo electrónico válido.`
              }
    },
    telefono:{type: String},
    institution:{type: String, required:function(){return this.tipo === "laboral"}, default:""},
    tipo: {type: String, enum: ["laboral", "personal", "familiar"]}
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
    sera:{type: String, enum: ["Enviado", "Revisado", "Aprobado"]}
});

const certificacionSchema = new mongoose.Schema({
    titulo:{type: String},
    institution:{type: String},
    horas:{type: Number},
    fecha:{type: Date},
    tipo: {type: String, enum: ["Nacional","Internacional"]},
    sera:{type: String, enum: ["Enviado", "Revisado", "Aprobado"]}
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
    sera:{type: String, enum: ["Enviado", "Revisado", "Aprobado"]}
})

const libroSchema = new mongoose.Schema({
    titulo:{type:String},
    editorial:{ type: String},
    isbn:{type: String},
    isnn:{type: String},
    año:{type: Number},
    pais:{type: String, default:"Ecuador"},
    tipo: {type: String, enum: ["Libro", "Capítulo"]},
    sera:{type: String, enum: ["Enviado", "Revisado", "Aprobado"]}
})

const ponenciaSchema = new mongoose.Schema({
    titulo:{type: String},
    evento:{type: String},
    año:{type: Number},
    pais:{type: String, default:"Ecuador"},
    sera:{type: String,enum: ["Enviado", "Revisado", "Aprobado"]}
});

const tesisSchema = new mongoose.Schema({
    ies:{type: String},
    tema:{type: String},
    programa:{type: String},
    nivel:{type: String, enum:["Técnico","Tecnólogo","Grado", "Maestría", "Diplomado","Doctorado", "Posdoctorado"]},
    año:{type: Number},
    rol:{ type: String, enum:["Revisor","Asesor"]},
    pais:{type: String, default:"Ecuador"},
    sera:{type: String, enum: ["Enviado", "Revisado", "Aprobado"]
    }
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
    sera:{type: String, enum: ["Enviado", "Revisado", "Aprobado"]}
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