import nodemailer from 'nodemailer';

// El servidor de correo saliente.
//
// ⚠️ EL PROVEEDOR ESTABA CABLEADO AQUI (`pro.turbo-smtp.com`), asi que no habia forma de apuntar a
// otro sitio sin tocar el codigo. Eso impedia lo mas util en desarrollo: un buzon local que reciba
// los correos y los enseñe, en vez de mandarlos de verdad o --peor-- saltarse el envio y dejar sin
// ejercitar el unico camino que importa.
//
// El valor por defecto es el que estaba, asi que un despliegue que no ponga nada se comporta
// exactamente igual que antes.
const host = process.env.SMTP_HOST || 'pro.turbo-smtp.com';
const port = Number(process.env.SMTP_PORT || 587);

// Un buzon local no pide credenciales; exigirselas lo rompe. Se mandan SOLO si las hay.
const auth = process.env.SMTP_USER
  ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  : undefined;

export const transporter = nodemailer.createTransport({
  host,
  port,
  // 465 es el unico puerto de SMTP que va cifrado desde el saludo; 587 y 1025 negocian con STARTTLS.
  secure: port === 465,
  auth,
});
