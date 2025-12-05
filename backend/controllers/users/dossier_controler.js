import { Dossier } from "../../models/users/dossiers.js";
import { Usuario } from "../../models/users/usuario_model.js";
import UserRepository from "../../services/auth/UserRepository.js";

const userRepository = new UserRepository();

const findUserRecords = async (cedula) => {
    const [mariaUser, mongoUser] = await Promise.all([
        userRepository.findByCedulaOrEmail({ cedula }).catch(() => null),
        Usuario.findOne({ cedula })
    ]);

    if (!mariaUser && !mongoUser) {
        return null;
    }

    return { mariaUser, mongoUser };
};

const buildDossierQuery = (cedula, mongoUser) => {
    const orConditions = [{ cedula }];
    if (mongoUser?._id) {
        orConditions.push({ usuario: mongoUser._id });
    }
    return orConditions.length > 1 ? { $or: orConditions } : orConditions[0];
};

const getOrCreateDossier = async (cedula) => {
    const userRecords = await findUserRecords(cedula);
    if (!userRecords) {
        return null;
    }
    const { mongoUser } = userRecords;

    const query = buildDossierQuery(cedula, mongoUser);
    let dossier = await Dossier.findOne(query);
    let requiresSave = false;

    if (!dossier) {
        dossier = new Dossier({
            usuario: mongoUser?._id ?? null,
            cedula,
            titulos: [],
            experiencia: [],
            referencias: [],
            formacion: [],
            certificaciones: [],
            investigacion: {
                articulos: [],
                libros: [],
                ponencias: [],
                tesis: [],
                proyectos: []
            }
        });
        requiresSave = true;
    } else {
        if (!dossier.cedula) {
            dossier.cedula = cedula;
            requiresSave = true;
        }

        if (!dossier.usuario && mongoUser?._id) {
            dossier.usuario = mongoUser._id;
            requiresSave = true;
        }
    }

    if (requiresSave) {
        await dossier.save();
    }

    return dossier;
};

// Obtener o crear dossier del usuario
export const getDossierByUser = async (req, res) => {
    try {
        const { cedula } = req.params;
        
        const dossier = await getOrCreateDossier(cedula);
        
        if (!dossier) {
            return res.status(404).json({ 
                success: false,
                message: "Usuario no encontrado" 
            });
        }

        res.json({
            success: true,
            data: dossier
        });

    } catch (error) {
        console.error('Error al obtener dossier:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error al obtener dossier',
            error: error.message 
        });
    }
};

// Agregar título académico
export const addTitulo = async (req, res) => {
    try {
        const { cedula } = req.params;
        
        const dossier = await getOrCreateDossier(cedula);
        if (!dossier) {
            return res.status(404).json({ 
                success: false,
                message: "Usuario no encontrado" 
            });
        }

        dossier.titulos.push(req.body);
        await dossier.save();

        res.json({
            success: true,
            message: 'Título agregado correctamente',
            data: dossier
        });

    } catch (error) {
        console.error('Error al agregar título:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error al agregar título',
            error: error.message 
        });
    }
};

// Agregar experiencia
export const addExperiencia = async (req, res) => {
    try {
        const { cedula } = req.params;
        
        const dossier = await getOrCreateDossier(cedula);
        if (!dossier) {
            return res.status(404).json({ 
                success: false,
                message: "Usuario no encontrado" 
            });
        }

        dossier.experiencia.push(req.body);
        await dossier.save();

        res.json({
            success: true,
            message: 'Experiencia agregada correctamente',
            data: dossier
        });

    } catch (error) {
        console.error('Error al agregar experiencia:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error al agregar experiencia',
            error: error.message 
        });
    }
};

// Agregar referencia
export const addReferencia = async (req, res) => {
    try {
        const { cedula } = req.params;
        
        const dossier = await getOrCreateDossier(cedula);
        if (!dossier) {
            return res.status(404).json({ 
                success: false,
                message: "Usuario no encontrado" 
            });
        }

        // Validar que el tipo de referencia sea válido antes de guardar
        const tiposValidos = ["laboral", "personal", "familiar"];
        if (req.body.tipo && !tiposValidos.includes(req.body.tipo)) {
            return res.status(400).json({ 
                success: false,
                message: `Tipo de referencia inválido: "${req.body.tipo}". Debe ser uno de: ${tiposValidos.join(', ')}` 
            });
        }

        dossier.referencias.push(req.body);
        await dossier.save();

        res.json({
            success: true,
            message: 'Referencia agregada correctamente',
            data: dossier
        });

    } catch (error) {
        console.error('Error al agregar referencia:', error);
        
        // Si es un error de validación de Mongoose, dar un mensaje más claro
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(e => e.message).join(', ');
            return res.status(400).json({ 
                success: false,
                message: `Error de validación: ${errors}`,
                error: error.message 
            });
        }

        res.status(500).json({ 
            success: false,
            message: 'Error al agregar referencia',
            error: error.message 
        });
    }
};

// Actualizar título
export const updateTitulo = async (req, res) => {
    try {
        const { cedula, tituloId } = req.params;
        
        const dossier = await getOrCreateDossier(cedula);
        if (!dossier) {
            return res.status(404).json({ 
                success: false,
                message: "Usuario no encontrado" 
            });
        }

        const titulo = dossier.titulos.id(tituloId);
        if (!titulo) {
            return res.status(404).json({ 
                success: false,
                message: "Título no encontrado" 
            });
        }

        Object.assign(titulo, req.body);
        await dossier.save();

        res.json({
            success: true,
            message: 'Título actualizado correctamente',
            data: dossier
        });

    } catch (error) {
        console.error('Error al actualizar título:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error al actualizar título',
            error: error.message 
        });
    }
};

// Eliminar título
export const deleteTitulo = async (req, res) => {
    try {
        const { cedula, tituloId } = req.params;
        
        const dossier = await getOrCreateDossier(cedula);
        if (!dossier) {
            return res.status(404).json({ 
                success: false,
                message: "Usuario no encontrado" 
            });
        }

        dossier.titulos.pull(tituloId);
        await dossier.save();

        res.json({
            success: true,
            message: 'Título eliminado correctamente',
            data: dossier
        });

    } catch (error) {
        console.error('Error al eliminar título:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error al eliminar título',
            error: error.message 
        });
    }
};

// Eliminar referencia
export const deleteReferencia = async (req, res) => {
    try {
        const { cedula, referenciaId } = req.params;
        
        const dossier = await getOrCreateDossier(cedula);
        if (!dossier) {
            return res.status(404).json({ 
                success: false,
                message: "Usuario no encontrado" 
            });
        }

        dossier.referencias.pull(referenciaId);
        await dossier.save();

        res.json({
            success: true,
            message: 'Referencia eliminada correctamente',
            data: dossier
        });

    } catch (error) {
        console.error('Error al eliminar referencia:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error al eliminar referencia',
            error: error.message 
        });
    }
};

// Agregar formacion (capacitación)
export const addFormacion = async (req, res) => {
    try {
        const { cedula } = req.params;
        
        const dossier = await getOrCreateDossier(cedula);
        if (!dossier) {
            return res.status(404).json({ 
                success: false,
                message: "Usuario no encontrado" 
            });
        }

        dossier.formacion.push(req.body);
        await dossier.save();

        res.json({
            success: true,
            message: 'Capacitación agregada correctamente',
            data: dossier
        });

    } catch (error) {
        console.error('Error al agregar capacitación:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error al agregar capacitación',
            error: error.message 
        });
    }
};

// Eliminar formacion (capacitación)
export const deleteFormacion = async (req, res) => {
    try {
        const { cedula, formacionId } = req.params;
        
        const dossier = await getOrCreateDossier(cedula);
        if (!dossier) {
            return res.status(404).json({ 
                success: false,
                message: "Usuario no encontrado" 
            });
        }

        dossier.formacion.pull(formacionId);
        await dossier.save();

        res.json({
            success: true,
            message: 'Capacitación eliminada correctamente',
            data: dossier
        });

    } catch (error) {
        console.error('Error al eliminar capacitación:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error al eliminar capacitación',
            error: error.message 
        });
    }
};

// Agregar certificación
export const addCertificacion = async (req, res) => {
    try {
        const { cedula } = req.params;
        
        const dossier = await getOrCreateDossier(cedula);
        if (!dossier) {
            return res.status(404).json({ 
                success: false,
                message: "Usuario no encontrado" 
            });
        }

        dossier.certificaciones.push(req.body);
        await dossier.save();

        res.json({
            success: true,
            message: 'Certificación agregada correctamente',
            data: dossier
        });

    } catch (error) {
        console.error('Error al agregar certificación:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error al agregar certificación',
            error: error.message 
        });
    }
};

// Eliminar certificación
export const deleteCertificacion = async (req, res) => {
    try {
        const { cedula, certificacionId } = req.params;
        
        const dossier = await getOrCreateDossier(cedula);
        if (!dossier) {
            return res.status(404).json({ 
                success: false,
                message: "Usuario no encontrado" 
            });
        }

        dossier.certificaciones.pull(certificacionId);
        await dossier.save();

        res.json({
            success: true,
            message: 'Certificación eliminada correctamente',
            data: dossier
        });

    } catch (error) {
        console.error('Error al eliminar certificación:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error al eliminar certificación',
            error: error.message 
        });
    }
};

