import jwt from "jsonwebtoken"

const isNonProduction = () => (process.env.NODE_ENV || "development") !== "production";

const getAccessTokenSecret = () => {
    const envSecret = process.env.JWT_SECRET || process.env.JWT_REFRESH;
    if (envSecret) {
        return envSecret;
    }

    if (isNonProduction()) {
        return "deasy-dev-access-secret";
    }

    return null;
};

export const validateToken = (req, res, next) => {

    console.log(req.headers.authorization)

    try {
        const token = req.headers.authorization.split(' ')[1];
        const secret = getAccessTokenSecret();

        if (!secret) {
            return res.status(500).send({ message: 'JWT no configurado' });
        }

        const verify = jwt.verify(token, secret);
        req.uid = verify;
        next();
    } catch (error) {
        return res.status(401).send({ message: 'Error in token validation' });
    }
}
