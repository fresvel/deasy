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

export const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({ message: "Token requerido" });
    }

    const token = authHeader.split(" ")[1];
    const secret = getAccessTokenSecret();

    if (!secret) {
      return res.status(500).json({ message: "JWT no configurado" });
    }

    const decoded = jwt.verify(token, secret);

    req.user = decoded;

    next();
  } catch (error) {
    return res.status(401).json({
      message: "Token inválido"
    });
  }
};