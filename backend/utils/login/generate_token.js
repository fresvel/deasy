import jwt from "jsonwebtoken";

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

const getRefreshTokenSecret = () => {
    const envSecret = process.env.JWT_REFRESH || process.env.JWT_SECRET;
    if (envSecret) {
        return envSecret;
    }

    if (isNonProduction()) {
        return "deasy-dev-refresh-secret";
    }

    return null;
};

export const generateToken = (uid) => {
    const expiresIn = 60 * 60 * 2; // 2 horas
    const secret = getAccessTokenSecret();

    if (!secret) {
        throw new Error("No hay secreto JWT configurado (JWT_SECRET/JWT_REFRESH)");
    }

    const token = jwt.sign({ uid }, secret, { expiresIn });
    return { token, expiresIn };
};

export const generateRefreshToken = (uid, res) => {
    const expiresIn = 60 * 60 * 24 * 30; // 30 dias
    const secret = getRefreshTokenSecret();

    if (!secret) {
        throw new Error("No hay secreto de refresh token configurado (JWT_REFRESH/JWT_SECRET)");
    }

    const token = jwt.sign({ uid }, secret, { expiresIn });
    res.cookie("refreshToken", token, {
        httpOnly: true,
        expires: new Date(Date.now() + expiresIn * 1000),
        secure: !(process.env.MODE === "Developer")
    });
};