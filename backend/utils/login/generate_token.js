
import jwt from "jsonwebtoken"
export const generateToken =(uid) => {
     const expiresIn = 60 * 60 * 2; // 2 horas
    try {
        
        const token= jwt.sign({uid}, process.env.JWT_SECRET, {expiresIn})
        return {token, expiresIn};

    } catch (error) {
        console.log(error)
    }

}

export const generateRefreshToken =(uid, res)=>{
    const expiresIn=60*60*24*30 //30 dias
    
    try {
    const token =jwt.sign({uid}, process.env.JWT_REFRESH, {expiresIn})
    res.cookie("refreshToken", token, { 
        httpOnly: true, 
        expires: new Date(Date.now() + expiresIn*1000), 
        secure:!(process.env.MODE==="Developer")})
    } catch (error) {
        
    }
    }