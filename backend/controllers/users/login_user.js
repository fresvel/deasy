import AuthService from "../../services/auth/AuthService.js";
import AuthenticationError from "../../errors/AuthenticationError.js";

const authService = new AuthService();

export const loginUser = async (req, res) => {
  try {
    const credentials = {
      email: req.body?.email,
      password: req.body?.password
    };

    if (!credentials.password || !credentials.email) {
      return res.status(400).send({
        message: "Debe proporcionar el correo electrónico y la contraseña",
        code: 400
      });
    }

    const { token, expiresIn, user } = await authService.login(credentials, res);

    res.json({
      token,
      expiresIn,
      user
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return res.status(401).send({ message: error.message, code: 401 });
    }

    console.error("Error en loginUser:", error);
    res.status(500).send({
      message: "Error interno al iniciar sesión"
    });
  }
};