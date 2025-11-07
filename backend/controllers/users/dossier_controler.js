import { Dossier } from "../../models/users/dossiers.js";
import { Usuario } from "../../models/users/usuario_model.js";

// Obtener o crear dossier del usuario
export const getDossierByUser = async (req, res) => {
    try {
        const { cedula } = req.params;
        
        // Buscar usuario por cédula
        const user = await Usuario.findOne({ cedula });
        
        if (!user) {
            return res.status(404).json({ 
                success: false,
                message: "Usuario no encontrado" 
            });
        }

        // Buscar dossier del usuario
        let dossier = await Dossier.findOne({ usuario: user._id });

        // Si no existe, crear uno vacío
        if (!dossier) {
            dossier = new Dossier({
                usuario: user._id,
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
            await dossier.save();
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
        
        const user = await Usuario.findOne({ cedula });
        if (!user) {
            return res.status(404).json({ 
                success: false,
                message: "Usuario no encontrado" 
            });
        }

        let dossier = await Dossier.findOne({ usuario: user._id });
        
        if (!dossier) {
            dossier = new Dossier({ usuario: user._id });
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
        
        const user = await Usuario.findOne({ cedula });
        if (!user) {
            return res.status(404).json({ 
                success: false,
                message: "Usuario no encontrado" 
            });
        }

        let dossier = await Dossier.findOne({ usuario: user._id });
        
        if (!dossier) {
            dossier = new Dossier({ usuario: user._id });
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
        
        const user = await Usuario.findOne({ cedula });
        if (!user) {
            return res.status(404).json({ 
                success: false,
                message: "Usuario no encontrado" 
            });
        }

        let dossier = await Dossier.findOne({ usuario: user._id });
        
        if (!dossier) {
            dossier = new Dossier({ usuario: user._id });
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
        
        const user = await Usuario.findOne({ cedula });
        if (!user) {
            return res.status(404).json({ 
                success: false,
                message: "Usuario no encontrado" 
            });
        }

        const dossier = await Dossier.findOne({ usuario: user._id });
        
        if (!dossier) {
            return res.status(404).json({ 
                success: false,
                message: "Dossier no encontrado" 
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
        
        const user = await Usuario.findOne({ cedula });
        if (!user) {
            return res.status(404).json({ 
                success: false,
                message: "Usuario no encontrado" 
            });
        }

        const dossier = await Dossier.findOne({ usuario: user._id });
        
        if (!dossier) {
            return res.status(404).json({ 
                success: false,
                message: "Dossier no encontrado" 
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
        
        const user = await Usuario.findOne({ cedula });
        if (!user) {
            return res.status(404).json({ 
                success: false,
                message: "Usuario no encontrado" 
            });
        }

        const dossier = await Dossier.findOne({ usuario: user._id });
        
        if (!dossier) {
            return res.status(404).json({ 
                success: false,
                message: "Dossier no encontrado" 
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

