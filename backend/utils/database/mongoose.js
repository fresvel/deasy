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
            e:{
                type : Boolean,
                default : false
            },
            r:{
                type : Boolean,
                default : false
            },
            a:{
                type : Boolean,
                default : false
            }
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
                e:{
                    type : Boolean,
                    default : false
                },
                r:{
                    type : Boolean,
                    default : false
                },
                a:{
                    type : Boolean,
                    default : false
                }
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
                e:{
                    type : Boolean,
                    default : false
                },
                r:{
                    type : Boolean,
                    default : false
                },
                a:{
                    type : Boolean,
                    default : false
                }
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
                e:{
                    type : Boolean,
                    default : false
                },
                r:{
                    type : Boolean,
                    default : false
                },
                a:{
                    type : Boolean,
                    default : false
                }
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
                e:{
                    type : Boolean,
                    default : false
                },
                r:{
                    type : Boolean,
                    default : false
                },
                a:{
                    type : Boolean,
                    default : false
                }
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
                e:{
                    type : Boolean,
                    default : false
                },
                r:{
                    type : Boolean,
                    default : false
                },
                a:{
                    type : Boolean,
                    default : false
                }
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
                    e:{
                        type : Boolean,
                        default : false
                    },
                    r:{
                        type : Boolean,
                        default : false
                    },
                    a:{
                        type : Boolean,
                        default : false
                    }
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
                e:{
                    type : Boolean,
                    default : false
                },
                r:{
                    type : Boolean,
                    default : false
                },
                a:{
                    type : Boolean,
                    default : false
                }
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
                e:{
                    type : Boolean,
                    default : false
                },
                r:{
                    type : Boolean,
                    default : false
                },
                a:{
                    type : Boolean,
                    default : false
                }
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
            e:{
                type : Boolean,
                default : false
            },
            r:{
                type : Boolean,
                default : false
            },
            a:{
                type : Boolean,
                default : false
            }
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
            e:{
                type : Boolean,
                default : false
            },
            r:{
                type : Boolean,
                default : false
            },
            a:{
                type : Boolean,
                default : false
            }
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
            e:{
                type : Boolean,
                default : false
            },
            r:{
                type : Boolean,
                default : false
            },
            a:{
                type : Boolean,
                default : false
            }
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

  function getEmptyStructure(schema) {
    if (Array.isArray(schema)) {
      return schema.map(getEmptyStructure);
    } else if (typeof schema === 'object' && schema !== null) {
      let emptyObj = {};
      for (const key in schema) {
        if (schema[key].type) {
          emptyObj[key] = getEmptyValue(schema[key].type);
        } else if (typeof schema[key] === 'object') {
          emptyObj[key] = getEmptyStructure(schema[key]);
        }
      }
      return emptyObj;
    }
  }
  
  function getEmptyValue(type) {
    if (type === String) return '';
    if (type === Number) return 0;
    if (type === Date) return null;
    if (type === Boolean) return false;
    if (Array.isArray(type)) return [];
    if (type === mongoose.Schema.Types.ObjectId) return null;
    return null;
  }
  
  // Uso:
  const emptyemploy = getEmptyStructure(empleadoSchema.obj.investigacion);
  console.log(emptyemploy);
