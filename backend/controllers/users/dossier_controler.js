import { Dossier } from "../../models/users/dossiers.js";
import { Usuario } from "../../models/users/usuario_model.js";
import UserRepository from "../../services/auth/UserRepository.js";
import * as Minio from "minio";
import path from "path";
import os from "os";
import fs from "fs";
import { promisify } from "util";

const userRepository = new UserRepository();
const INVESTIGACION_TIPOS = new Set(["articulos", "libros", "ponencias", "tesis", "proyectos"]);

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

const ensureInvestigacionShape = (dossier) => {
    if (!dossier.investigacion) {
        dossier.investigacion = {
            articulos: [],
            libros: [],
            ponencias: [],
            tesis: [],
            proyectos: []
        };
        return true;
    }

    let changed = false;
    for (const tipo of INVESTIGACION_TIPOS) {
        if (!Array.isArray(dossier.investigacion[tipo])) {
            dossier.investigacion[tipo] = [];
            changed = true;
        }
    }
    return changed;
};

const getInvestigacionTipo = (tipoRaw) => {
    const tipo = String(tipoRaw || "").toLowerCase();
    if (!INVESTIGACION_TIPOS.has(tipo)) {
        return null;
    }
    return tipo;
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

// Agregar registro de investigación por tipo
export const addInvestigacionItem = async (req, res) => {
    try {
        const { cedula, tipo } = req.params;
        const investigacionTipo = getInvestigacionTipo(tipo);
        if (!investigacionTipo) {
            return res.status(400).json({
                success: false,
                message: "Tipo de investigación inválido. Usa: articulos, libros, ponencias, tesis o proyectos."
            });
        }

        const dossier = await getOrCreateDossier(cedula);
        if (!dossier) {
            return res.status(404).json({
                success: false,
                message: "Usuario no encontrado"
            });
        }

        const reshaped = ensureInvestigacionShape(dossier);
        dossier.investigacion[investigacionTipo].push(req.body);
        if (reshaped) {
            dossier.markModified("investigacion");
        }
        await dossier.save();

        res.json({
            success: true,
            message: "Registro de investigación agregado correctamente",
            data: dossier
        });
    } catch (error) {
        console.error("Error al agregar investigación:", error);
        res.status(500).json({
            success: false,
            message: "Error al agregar investigación",
            error: error.message
        });
    }
};

// Actualizar registro de investigación por tipo
export const updateInvestigacionItem = async (req, res) => {
    try {
        const { cedula, tipo, itemId } = req.params;
        const investigacionTipo = getInvestigacionTipo(tipo);
        if (!investigacionTipo) {
            return res.status(400).json({
                success: false,
                message: "Tipo de investigación inválido. Usa: articulos, libros, ponencias, tesis o proyectos."
            });
        }

        const dossier = await getOrCreateDossier(cedula);
        if (!dossier) {
            return res.status(404).json({
                success: false,
                message: "Usuario no encontrado"
            });
        }

        const reshaped = ensureInvestigacionShape(dossier);
        const item = dossier.investigacion[investigacionTipo].id(itemId);
        if (!item) {
            return res.status(404).json({
                success: false,
                message: "Registro de investigación no encontrado"
            });
        }

        Object.assign(item, req.body);
        if (reshaped) {
            dossier.markModified("investigacion");
        }
        await dossier.save();

        res.json({
            success: true,
            message: "Registro de investigación actualizado correctamente",
            data: dossier
        });
    } catch (error) {
        console.error("Error al actualizar investigación:", error);
        res.status(500).json({
            success: false,
            message: "Error al actualizar investigación",
            error: error.message
        });
    }
};

// Eliminar registro de investigación por tipo
export const deleteInvestigacionItem = async (req, res) => {
    try {
        const { cedula, tipo, itemId } = req.params;
        const investigacionTipo = getInvestigacionTipo(tipo);
        if (!investigacionTipo) {
            return res.status(400).json({
                success: false,
                message: "Tipo de investigación inválido. Usa: articulos, libros, ponencias, tesis o proyectos."
            });
        }

        const dossier = await getOrCreateDossier(cedula);
        if (!dossier) {
            return res.status(404).json({
                success: false,
                message: "Usuario no encontrado"
            });
        }

        const reshaped = ensureInvestigacionShape(dossier);
        dossier.investigacion[investigacionTipo].pull(itemId);
        if (reshaped) {
            dossier.markModified("investigacion");
        }
        await dossier.save();

        res.json({
            success: true,
            message: "Registro de investigación eliminado correctamente",
            data: dossier
        });
    } catch (error) {
        console.error("Error al eliminar investigación:", error);
        res.status(500).json({
            success: false,
            message: "Error al eliminar investigación",
            error: error.message
        });
    }
};

const minioUrl = new URL(process.env.MINIO_ENDPOINT || "http://localhost:9000");
const minioUseSSL = String(process.env.MINIO_USE_SSL || "").trim() === "1" || minioUrl.protocol === "https:";
const minioClient = new Minio.Client({
    endPoint: minioUrl.hostname,
    port: Number(minioUrl.port || (minioUseSSL ? 443 : 80)),
    useSSL: minioUseSSL,
    accessKey: process.env.MINIO_ACCESS_KEY || process.env.MINIO_ROOT_USER,
    secretKey: process.env.MINIO_SECRET_KEY || process.env.MINIO_ROOT_PASSWORD
});

const MINIO_DOSSIER_BUCKET = process.env.MINIO_DOSSIER_BUCKET || "deasy-dossier";
const MINIO_DOSSIER_PREFIX = process.env.MINIO_DOSSIER_PREFIX || "Dosier";
const MINIO_PUBLIC_ENDPOINT = process.env.MINIO_PUBLIC_ENDPOINT || "http://localhost:9000";

const VALID_DOCUMENT_TYPES = [
    "titulo", "experiencia", "referencia", "formacion", 
    "certificacion", "articulo", "libro", "ponencia", 
    "tesis", "proyecto"
];

const getCollectionAndField = (tipoDocumento) => {
    const mapping = {
        titulo: { collection: "titulos", field: "titulos" },
        experiencia: { collection: "experiencia", field: "experiencia" },
        referencia: { collection: "referencias", field: "referencias" },
        formacion: { collection: "formacion", field: "formacion" },
        certificacion: { collection: "certificaciones", field: "certificaciones" },
        articulo: { collection: "articulos", field: "investigacion.articulos" },
        libro: { collection: "libros", field: "investigacion.libros" },
        ponencia: { collection: "ponencias", field: "investigacion.ponencias" },
        tesis: { collection: "tesis", field: "investigacion.tesis" },
        proyecto: { collection: "proyectos", field: "investigacion.proyectos" }
    };
    return mapping[tipoDocumento] || null;
};

const uploadFileToMinIO = (bucket, objectName, filePath, metadata = {}) => {
    return new Promise((resolve, reject) => {
        minioClient.fPutObject(bucket, objectName, filePath, metadata, (error, etag) => {
            if (error) {
                reject(error);
            } else {
                resolve(etag);
            }
        });
    });
};

const ensureBucketExists = (bucket) => {
    return new Promise((resolve, reject) => {
        minioClient.bucketExists(bucket, (error, exists) => {
            if (error) {
                reject(error);
            } else if (exists) {
                resolve(true);
            } else {
                minioClient.makeBucket(bucket, "", (makeError) => {
                    if (makeError) {
                        reject(makeError);
                    } else {
                        resolve(true);
                    }
                });
            }
        });
    });
};

export const uploadDossierDocument = async (req, res) => {
    try {
        const { cedula, tipoDocumento, registroId } = req.params;
        
        if (!cedula || !tipoDocumento || !registroId) {
            return res.status(400).json({
                success: false,
                message: "Faltan parámetros requeridos: cedula, tipoDocumento, registroId"
            });
        }

        if (!VALID_DOCUMENT_TYPES.includes(tipoDocumento)) {
            return res.status(400).json({
                success: false,
                message: `Tipo de documento inválido. Tipos válidos: ${VALID_DOCUMENT_TYPES.join(", ")}`
            });
        }

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "No se ha proporcionado ningún archivo"
            });
        }

        if (req.file.mimetype !== "application/pdf") {
            return res.status(400).json({
                success: false,
                message: "Solo se permiten archivos PDF"
            });
        }

        const tempFilePath = req.file.path;
        const objectName = `${MINIO_DOSSIER_PREFIX}/users/${cedula}/${tipoDocumento}/${registroId}.pdf`;

        await ensureBucketExists(MINIO_DOSSIER_BUCKET);

        await uploadFileToMinIO(MINIO_DOSSIER_BUCKET, objectName, tempFilePath);

        const fileUrl = `${MINIO_PUBLIC_ENDPOINT}/${MINIO_DOSSIER_BUCKET}/${objectName}`;

        fs.unlink(tempFilePath, (unlinkError) => {
            if (unlinkError) {
                console.error("Error al eliminar archivo temporal:", unlinkError);
            }
        });

        const mapping = getCollectionAndField(tipoDocumento);
        if (!mapping) {
            return res.status(400).json({
                success: false,
                message: "Tipo de documento inválido"
            });
        }

        const dossier = await Dossier.findOne({ cedula });
        if (!dossier) {
            return res.status(404).json({
                success: false,
                message: "Dossier no encontrado para esta cédula"
            });
        }

        let itemFound = false;

        if (mapping.field.startsWith("investigacion.")) {
            const investigacionField = mapping.field.replace("investigacion.", "");
            const item = dossier.investigacion?.[investigacionField]?.id(registroId);
            if (item) {
                item.url_documento = fileUrl;
                dossier.markModified(mapping.field);
                itemFound = true;
            }
        } else {
            const item = dossier[mapping.field]?.id(registroId);
            if (item) {
                item.url_documento = fileUrl;
                dossier.markModified(mapping.field);
                itemFound = true;
            }
        }

        if (!itemFound) {
            return res.status(404).json({
                success: false,
                message: `Registro con ID ${registroId} no encontrado en ${tipoDocumento}`
            });
        }

        await dossier.save();

        res.json({
            success: true,
            message: "Documento subido correctamente",
            url: fileUrl
        });

    } catch (error) {
        console.error("Error al subir documento:", error);
        
        if (req.file?.path) {
            fs.unlink(req.file.path, () => {});
        }

        res.status(500).json({
            success: false,
            message: "Error al subir documento",
            error: error.message
        });
    }
};

export const getDossierDocumentUrl = async (req, res) => {
    try {
        const { cedula, tipoDocumento, registroId } = req.params;
        
        if (!cedula || !tipoDocumento || !registroId) {
            return res.status(400).json({
                success: false,
                message: "Faltan parámetros requeridos: cedula, tipoDocumento, registroId"
            });
        }

        if (!VALID_DOCUMENT_TYPES.includes(tipoDocumento)) {
            return res.status(400).json({
                success: false,
                message: `Tipo de documento inválido. Tipos válidos: ${VALID_DOCUMENT_TYPES.join(", ")}`
            });
        }

        const objectName = `${MINIO_DOSSIER_PREFIX}/users/${cedula}/${tipoDocumento}/${registroId}.pdf`;

        try {
            await new Promise((resolve, reject) => {
                minioClient.getObject(MINIO_DOSSIER_BUCKET, objectName, (err, dataStream) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    
                    res.setHeader('Content-Type', 'application/pdf');
                    res.setHeader('Content-Disposition', `inline; filename="${registroId}.pdf"`);
                    
                    dataStream.pipe(res);
                    dataStream.on('end', resolve);
                    dataStream.on('error', reject);
                });
            });
        } catch (error) {
            console.error("Error al obtener archivo:", error.message);
            return res.status(404).json({
                success: false,
                message: "Error al leer documento: " + error.message
            });
        }

    } catch (error) {
        console.error("Error al obtener URL del documento:", error);
        res.status(500).json({
            success: false,
            message: "Error al obtener URL del documento",
            error: error.message
        });
    }
};
