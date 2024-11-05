import bcrypt from "bcrypt"

export const validateCreateuser = async(req, res, next) =>{
    
    console.log(req.body)

    try {
        console.log('Hashing password');    
        const saltos=await bcrypt.genSalt(10)
        req.body.password = await bcrypt.hash(req.body.password, saltos)
        next();
    } catch (error) {
        console.log('Hashing Error');   
        res.status(400).send({
            message: 'Error al validar los datos',
            error: error.message
        });
    }


}