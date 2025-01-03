import { Usuario } from "../../models/users/usuario_model.js";
import bcrypt from "bcrypt";
import { generateToken, generateRefreshToken } from "../../utils/login/generate_token.js";

export const loginUser = async (req, res) =>{

console.log("loginUser");
console.log(req.cookies);
console.log(req.body);

console.log("loginUser");

    let user = await Usuario.findOne({ cedula: req.body.cedula });
    
    if (!user) {
        user = await Usuario.findOne({ username: req.body.correo});
    }

    if (!user) return res.status(401).send({ message: 'Nombre de usuario o contraseña incorrectos 01', code:401 });
    console.log(user.password);

    const pass_correcto = await bcrypt.compare(req.body.password, user.password);
    
    if (!pass_correcto) return res.status(401).send({ message: 'Nombre de usuario o contraseña incorrectos 02', code:401 });
    console.log(user);
    generateRefreshToken(user._id, res)
    const { token, expiresIn}=generateToken(user._id)
    res.json({token, expiresIn});
}