/**
 * Controlador para cerrar sesión de usuario
 * Limpia la cookie del refreshToken
 */
export const logoutUser = async (req, res) => {
  try {
    // Limpiar la cookie del refreshToken con los mismos parámetros con los que se creó
    // Para limpiar correctamente, debemos usar los mismos atributos (path, domain, etc.)
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.MODE !== 'Developer',
      path: '/'
    });

    res.status(200).json({
      message: 'Sesión cerrada exitosamente',
      code: 200
    });
  } catch (error) {
    console.error('Error en logoutUser:', error);
    res.status(500).send({
      message: 'Error interno al cerrar sesión',
      code: 500
    });
  }
};

