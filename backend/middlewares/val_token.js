import jwt from "jsonwebtoken"

export const validateToken=(req, res, next) => {

    console.log(req.headers.authorization)

    try {
        const token = req.headers.authorization.split(' ')[1];
        const verify= jwt.verify(token,process.env.JWT_SECRET);
        req.uid=verify;
        next();
    } catch (error) {
        return res.status(401).send({ message: 'Error in token validation' });
    }
}
