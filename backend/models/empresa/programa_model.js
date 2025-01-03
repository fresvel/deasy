import mongoose from "mongoose";


const regdocentes = [
    {
        docente:{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Docente',
            required: true,
        },
        area:{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Area',
            required: true,
        },
        cargo:{
            type: String,
            required: true,
            enum:["Director","Subdirector","Jefe de ��rea","Encargado","Auxiliar"],
        },
        estatus:{
            type: String,
            default: "activo",
            enum:["activo","inactivo"],
        },
    }
]

const programaSchema = new mongoose.Schema(
    {
        code:{
            type: String,
            required: true,
            unique:true
        },
        name:{
            type:String,
            required:true,
        },
        facultad:{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Facultad'
        },
        nivel:{
            type: String,
            required:true,
            enum:["Grado", "Maestría", "Doctorado","Técnico", "Tecnológico"]
        },
        coordinador:{ //Aquí asignar roles de coordinador al usuario
            type: mongoose.Schema.Types.ObjectId,
            required:true,
            ref:"Docente",
        },
        docentes: [{ 
            usuario:{
                type: mongoose.Schema.Types.ObjectId,
                ref: "Usuario"
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
            categoria:{
                type: String,
                enum:["Honorario","Ocasional","Invitado", "Emérito", "Axiliar 1", "Auxiliar 2", "Agregado 1", "Agregado 2", "Agregado 3", "Principal 1", "Principal 2", "Principal 3"]
            },
        }],
        consejo:{ //Aquí asignar roles de consejo al usuario
            docentes:[
                {
                    docente:{
                        type: mongoose.Schema.Types.ObjectId,
                        ref: "Docente"
                    },
                    mención:{
                        type:String,
                    }
                }
            ],
            estudiantes:[
                {
                    estudiante:{
                        type: mongoose.Schema.Types.ObjectId,
                        ref: "Estudiante"
                    },
                    mención:{
                        type:String,
                    }
                }
            ],
        },
        calidad:{ //Aquí asignar roles de calidad al usuario
            docentes:[
                {
                    docente:{
                        type: mongoose.Schema.Types.ObjectId,
                        ref: "Docente"
                    },
                    mención:{
                        type:String,
                    }
                }
            ],
            estudiantes:[
                {
                    estudiante:{
                        type: mongoose.Schema.Types.ObjectId,
                        ref: "Estudiante"
                    },
                    mención:{
                        type:String,
                    }
                }
            ],
        }
    });



// Helper para actualizar perfiles
const actualizarPerfiles = async (Usuario, usuariosNuevos, usuariosAntiguos, perfil) => {

    console.log("Actualizando Perfil");
    // Eliminar el perfil de usuarios antiguos
    if (usuariosAntiguos?.length) {
        await Usuario.updateMany(
            { _id: { $in: usuariosAntiguos } },
            { $pull: { perfiles: perfil } }
        );
    }

    // Agregar el perfil a usuarios nuevos
    if (usuariosNuevos?.length) {
        await Usuario.updateMany(
            { _id: { $in: usuariosNuevos } },
            { $addToSet: { perfiles: perfil } }
        );
    }
};

// Middleware post-save para agregar perfiles
programaSchema.post("save", async function (doc) {
    const Usuario = mongoose.model("Usuario");

    // Coordinador
    await actualizarPerfiles(Usuario, [doc.coordinador], [], "67745256259e33e6cddcd14e");//Cambiar por id de coordinador

    // Docentes
    await actualizarPerfiles(Usuario, doc.docentes, [], "677452e7259e33e6cddcd152"); //Cambiar por id de Docente
});

// Middleware pre-update para actualizar perfiles
programaSchema.pre("findOneAndUpdate", async function (next) {
    const Usuario = mongoose.model("Usuario");
    const currentDoc = await this.model.findOne(this.getQuery());
    const update = this.getUpdate();

    if (currentDoc) {
        // Actualizar Coordinador
        if (update.coordinador && update.coordinador !== currentDoc.coordinador) {
            await actualizarPerfiles(
                Usuario,
                [update.coordinador],
                [currentDoc.coordinador],
                "67745256259e33e6cddcd14e" ////Cambiar por id de coordinador
            );
        }

        // Actualizar Docentes
        if (update.docentes) {
            await actualizarPerfiles(
                Usuario,
                update.docentes,
                currentDoc.docentes,
                "677452e7259e33e6cddcd152" //Cambiar por id de docente
            );
        }
    }

    next();
});


export const Program=new mongoose.model('Programa', programaSchema);