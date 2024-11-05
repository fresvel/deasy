
export const validateFile = (req, res, next) =>{
    if (!req.file) {
        return res.status(400).json({ error: 'No se adjunto un archivo' });
    }
    next();
}