import React from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import "./login.css";

export const Login = (): JSX.Element => {
  return (
    <div className="login-container">
      <img
        className="background-image"
        alt="Image"
        src="/image-3.png"
      />

      <div className="overlay" />

      <div className="content-wrapper">
        <div className="text-center mb-5">
          <div className="title-container">
            <span className="title-puce">PUCE</span>
            <span className="title-space">&nbsp;</span>
            <span className="title-esmeraldas">ESMERALDAS</span>
          </div>
          <div className="subtitle">
            Excelencia academica con sentido humano
          </div>
        </div>

        <div className="card login-card">
          <div className="card-body">
            <div className="text-center mb-4">
              <h1 className="login-title">
                INICIAR SESIÓN
              </h1>
              <p className="login-subtitle">
                Sistema DEASY PUCESE
              </p>
            </div>

            <form>
              <div className="mb-4">
                <label className="form-label-custom">
                  Usuario
                </label>
                <input
                  type="text"
                  className="form-control form-control-custom"
                />
              </div>

              <div className="mb-4">
                <label className="form-label-custom">
                  Contraseña
                </label>
                <input
                  type="password"
                  className="form-control form-control-custom"
                />
              </div>

              <button type="submit" className="btn btn-primary-custom w-100 mb-3">
                Iniciar sesión
              </button>

              <button type="button" className="btn btn-link forgot-password">
                ¿Olvidaste tu contraseña?
              </button>

              <button type="button" className="btn btn-outline-custom w-100">
                Crear usuario
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
