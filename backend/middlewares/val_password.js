import bcrypt from "bcrypt";

export const validatePassword = async (req, res, next) => {
    const { password } = req.body;
    
    if (!password) {
        return res.status(400).send({
            message: 'La contraseña es requerida',
            code: 400
        });
    }
    
    // Validaciones de políticas de contraseña
    const validations = {
        length: password.length >= 8,
        lowercase: /[a-z]/.test(password),
        uppercase: /[A-Z]/.test(password),
        number: /[0-9]/.test(password),
        special: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)
    };
    
    // Verificar que cumple al menos 3 de los 4 criterios obligatorios
    const requiredCriteria = [
        validations.length,
        validations.lowercase,
        validations.uppercase,
        validations.number
    ];
    
    const passedCriteria = requiredCriteria.filter(Boolean).length;
    
    if (passedCriteria < 3) {
        return res.status(400).send({
            message: 'La contraseña debe cumplir al menos 3 de los siguientes criterios: 8+ caracteres, mayúscula, minúscula, número',
            code: 400,
            details: {
                length: validations.length,
                lowercase: validations.lowercase,
                uppercase: validations.uppercase,
                number: validations.number,
                special: validations.special
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
