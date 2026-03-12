import jwt from "jsonwebtoken";
import { generateToken } from "../../utils/login/generate_token.js";

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
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH);
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
