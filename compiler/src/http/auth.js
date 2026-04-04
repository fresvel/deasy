const COMPILER_SHARED_TOKEN = String(process.env.COMPILER_SHARED_TOKEN || "").trim();

export const requireServiceAuth = (req, res, next) => {
  if (!COMPILER_SHARED_TOKEN) {
    next();
    return;
  }

  const authorization = String(req.headers.authorization || "").trim();
  const expected = `Bearer ${COMPILER_SHARED_TOKEN}`;
  if (authorization !== expected) {
    res.status(401).json({
      error: {
        code: "unauthorized_service",
        message: "Token de servicio inválido para el compilador.",
        stage: "auth",
        retryable: false,
      },
    });
    return;
  }

  next();
};
