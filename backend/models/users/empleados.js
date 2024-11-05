import mongoose from "mongoose";

const empleadoSchema=new mongoose.Schema({
    
    usuario:{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Usuario",
        required: true
    },
    titulos:[{
        titulo:{
            type: String,
        },
        ies:{
            type: String,
        },
        tipo:{
            type: String,
            required: true,
            enum:["Técnico","Tecnólogo","Grado", "Maestría", "Diplomado","Doctorado", "Posdoctorado"]
        },
        sreg:{//Número de registro en senescyt
            type: String,
        },
        nivel:{
            type: String,
            required: true,
            enum:["Licenciatura","Maestría","Doctorado"]
        },
        sera:{
            type: String,
            enum: ["Enviado", "Revisado", "Aprobado"] //Pasa a aprobado cuando se contrata
        }

    }],
    experiencia:{
        docente:[{
            institucion:{
                type: String,
            },
            catedra:{
                type: [String],
            },
            fecha_inicio:{//calcular años
                type: Date,
            },
            fecha_fin:{
                type: Date,
            },
            actividades:{
                type: [String],
            },
            sera:{
                type: String,
                enum: ["Enviado", "Revisado", "Aprobado"]
            }
        }],
        profesional:[{
            institucion:{
                type: String,
            },
            funcion:{
                type: String,
            },
            fecha_inicio:{
                type: Date,
            },
            fecha_fin:{
                type: Date,
            },
            actividades:{
                type: [String],
            },
            sera:{
                type: String,
                enum: ["Enviado", "Revisado", "Aprobado"]
            }
        }],
        referencias:[{
            nombre:{
                type: String,
            },
            cargo:{
                type: String,
            },
            email:{
                type: String,
                validate: {
                    validator: function (v) {
                      // Validación básica de formato de email
                      return /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(v);
                    },
                    message: props => `${props.value} no es un correo electrónico válido.`
                  }
            },
            telefono:{
                type: String,
            },
            institution:{
                type: String,
            }
        }]
    },
    capacitacion:{
        especialidad:[{
            tema:{
                type: String,
            },
            institution:{
                type: String,
            },
            horas:{
                type: Number,
            },
            fecha_inicio:{
                type: Date,
            },
            fecha_fin:{
                type: Date,
            },
            sera:{
                type: String,
                enum: ["Enviado", "Revisado", "Aprobado"]
            }
        }],
        docencia:[{
            tema:{
                type: String,
            },
            institution:{
                type: String,
            },
            horas:{
                type: Number,
            },
            fecha_inicio:{
                type: Date,
            },
            fecha_fin:{
                type: Date,
            },
            sera:{
                type: String,
                enum: ["Enviado", "Revisado", "Aprobado"]
            }
        }],
        impartida:[{
            tema:{
                type: String,
            },
            institution:{
                type: String,
            },
            horas:{
                type: Number,
            },
            fecha_inicio:{
                type: Date,
            },
            fecha_fin:{
                type: Date,
            },
            sera:{
                type: String,
                enum: ["Enviado", "Revisado", "Aprobado"]
            }
        }],

    },

    investigacion:{
        articulos:[{
                titulo:{
                    type:String,
                },
                base:{
                    type: String,
                },
                revista:{
                    type: String,
                },
                doi:{
                    type: String,
                },
                issn:{
                    type: String,
                },
                sjr:{
                    type: Number,
                },
                fecha:{
                    type: Date,
                },
                estado:{
                    type: String,
                    enum: ["Aceptado", "Publicado"]
                },
                rol:{
                    type: String,
                    enum: ["Autor", "Coautor", "Revisor"]
                },
                sera:{
                    type: String,
                    enum: ["Enviado", "Revisado", "Aprobado"] //Concatenar hacia el informe, si se aprueba en el informe se aprueba acá
                } 
        }],
        libros:[{
            titulo:{
                type:String,
            },
            editorial:{
                type: String,
            },
            isbn:{
                type: String,
            },
            issn:{
                type: String,
            },
            año:{
                type: Number,
            },
            sera:{
                type: String,
                enum: ["Enviado", "Revisado", "Aprobado"]
            }
        }],
        capitulos:[{
            titulo:{
                type:String,
            },
            editorial:{
                type: String,
            },
            isbn:{
                type: String,
            },
            issn:{
                type: String,
            },
            año:{
                type: Number,
            },
            sera:{
                type: String,
                enum: ["Enviado", "Revisado", "Aprobado"]
            }
        }]
    },
    ponencias:[{
        titulo:{
            type: String,
        },
        evento:{
            type: String,
        },
        año:{
            type: Number
        },
        sera:{
            type: String,
            enum: ["Enviado", "Revisado", "Aprobado"]
        }
    }],
    tesis:[{
        ies:{
            type: String,
        },
        tema:{
            type: String,
        },
        programa:{
            type: String,
        },
        nivel:{
            type: String,
            enum:["Técnico","Tecnólogo","Grado", "Maestría", "Diplomado","Doctorado", "Posdoctorado"]
        },
        año:{
            type: Number
        },
        accion:{
            type: String,
            enum:["Revisor","Asesor"] //agregar default  Asesor si es que es postulante para CV
        },
        sera:{
            type: String,
            enum: ["Enviado", "Revisado", "Aprobado"]
        }
    }],
    vinculacion:[{
        proyecto:{
            type: String,
        },
        institucion:{
            type: String,
        },
        año:{
            type: Number,
        },
        sera:{
            type: String,
            enum: ["Enviado", "Revisado", "Aprobado"]
        }
    }],
    relacion:{
        estado:{
            type: String,
            required: true,
            enum:["Postulante","Contratado","Desvinculado", "Licenciado"]
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
            categoria:{
                type: String,
                enum:["Honorario","Ocasional","Invitado", "Emérito", "Axiliar 1", "Auxiliar 2", "Agregado 1", "Agregado 2", "Agregado 3", "Principal 1", "Principal 2", "Principal 3"]
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