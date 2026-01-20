import nodemailer from 'nodemailer';

export const transporter = nodemailer.createTransport({
  host: 'pro.turbo-smtp.com',
  port: 587,
  secure: false, 
  auth: {
    user: process.env.SMTP_USER, 
    pass: process.env.SMTP_PASS, 
  },
});
