import bcrypt from "bcrypt";
import { evaluatePasswordPolicy } from "../utils/passwordPolicy.js";

export const validatePassword = async (req, res, next) => {
    const { password } = req.body;

    if (!password) {
        return res.status(400).send({
            message: 'La contraseña es requerida',
            code: 400
        });
    }

    // La política vive en un único sitio (utils/passwordPolicy.js). Aquí solo se
    // conserva la forma de la respuesta HTTP: el mensaje propio y el desglose de
    // criterios (incluido `special`, que es una sugerencia y no cuenta para aprobar).
    const { criteria, passed } = evaluatePasswordPolicy(password);
    if (!passed) {
        return res.status(400).send({
            message: 'La contraseña debe cumplir al menos 3 de los siguientes criterios: 8+ caracteres, mayúscula, minúscula, número',
            code: 400,
            details: {
                length: criteria.length,
                lowercase: criteria.lowercase,
                uppercase: criteria.uppercase,
                number: criteria.number,
                special: criteria.special
            }
        });
    }

    // Si pasa las validaciones, proceder con el hash
    try {
        console.log('Hashing password with new policies');
        const saltos = await bcrypt.genSalt(10);
        req.body.password = await bcrypt.hash(password, saltos);
        next();
    } catch (error) {
        console.log('Hashing Error');
        res.status(400).send({
            message: 'Error al procesar la contraseña',
            error: error.message
        });
    }
};
