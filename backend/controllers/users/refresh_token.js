import jwt from "jsonwebtoken";
import { generateToken } from "../../utils/login/generate_token.js";

const isNonProduction = () => (process.env.NODE_ENV || "development") !== "production";

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

/**
 * Controlador para refrescar el token de acceso
 * Usa el refreshToken de la cookie para generar un nuevo access token
 */
export const refreshToken = async (req, res) => {
  try {
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({
        message: 'No se encontró refresh token',
        code: 401
      });
    }

    // Verificar el refresh token
    let decoded;
    try {
      const secret = getRefreshTokenSecret();

      if (!secret) {
        return res.status(500).json({
          message: 'JWT no configurado',
          code: 500
        });
      }

      decoded = jwt.verify(refreshToken, secret);
    } catch (error) {
      return res.status(401).json({
        message: 'Refresh token inválido o expirado',
        code: 401
      });
    }

    // Generar nuevo access token
    const userId = decoded.uid;
    const { token, expiresIn } = generateToken(userId);

    res.json({
      token,
      expiresIn,
      message: 'Token refrescado exitosamente'
    });
  } catch (error) {
    console.error('Error en refreshToken:', error);
    res.status(500).json({
      message: 'Error interno al refrescar token',
      code: 500
    });
  }
};
