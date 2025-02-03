import mongoose from 'mongoose';
import crypto from 'crypto';
import fs from 'fs-extra';
import { Certificate } from '../../../../models/users/certificate_model.js';

class CertificateManager {

  static deriveKey(password, salt) {
    return new Promise((resolve, reject) => {
      crypto.pbkdf2(password, salt, 100000, 32, 'sha256', (err, derivedKey) => {
        if (err) reject(err);
        resolve(derivedKey);
      });
    });
  }


  static async encryptAndStoreCertificate(filePath, password, userId) {

    if (!fs.existsSync(filePath)) {
      throw new Error('El archivo .p12 no existe');
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error('El userId proporcionado no es válido');
    }

    const salt = crypto.randomBytes(16); // Crear un salt único
    const derivedKey = await this.deriveKey(password, salt.toString('hex')); // Derivar clave
    console.log('Cifer Salt: ' + salt.toString('hex'));
    console.log('Cifer Key: ', derivedKey);

    const iv = crypto.randomBytes(16); // IV aleatorio para AES
    const cipher = crypto.createCipheriv('aes-256-cbc', derivedKey, iv);
    console.log('IV: ', iv.toString('hex'));

    const fileBuffer = fs.readFileSync(filePath); // Leer archivo .p12

    let encrypted = Buffer.concat([cipher.update(fileBuffer), cipher.final()]);

    // Almacenar en MongoDB
    const certificate = new Certificate({
      userId: new mongoose.Types.ObjectId(userId), // Asegurarse de que sea un ObjectId
      filename: filePath.split('/').pop(),
      certificateData: encrypted,
      encryptionSalt: salt.toString('hex'), // Guardar salt en la base de datos
      encryptionKey: iv.toString('hex'), // Guardar IV en la base de datos
    });

    await certificate.save();
    console.log('Archivo .p12 cifrado y almacenado con éxito');
  }

  // Recuperar y descifrar el archivo .p12 usando la clave derivada
  static async decryptAndRetrieveCertificate(certificateId, password, outputPath) {
    const certificate = await Certificate.findById(certificateId);
    if (!certificate) {
      throw new Error('Certificado no encontrado');
    }

    const salt = Buffer.from(certificate.encryptionSalt, 'hex'); // Recuperar salt

    const derivedKey = await this.deriveKey(password, certificate.encryptionSalt); // Derivar clave con la contraseña
    console.log("salt", salt)
    console.log("derivedKey: ", derivedKey)
    const iv = Buffer.from(certificate.encryptionKey, 'hex'); // Recuperar IV
    console.log('IV: ', iv.toString('hex'));
    const decipher = crypto.createDecipheriv('aes-256-cbc', derivedKey, iv);

    const decrypted = Buffer.concat([decipher.update(certificate.certificateData), decipher.final()]);

    fs.writeFileSync(outputPath, decrypted); // Guardar el archivo descifrado
    console.log('Archivo .p12 recuperado y descifrado con éxito');
  }
}


try {
    await mongoose.connect("mongodb://localhost:27017/deasy")
    console.log("Connected to MongoDB")
} catch (error) {
    console.error("Error connecting to MongoDB:", error);
}

/*
// Usar la clase CertificateManager para cifrar y almacenar el archivo
const filePath = '../my_cert.p12';  // Ruta al archivo .p12
const password = 'usuarioPassword123'; // Contraseña del usuario (se usará para derivar la clave)
const userId = '677703fc9db105315f75d5b2'; // ID de usuario en la base de datos (suponiendo que es un ObjectId de MongoDB)



CertificateManager.encryptAndStoreCertificate(filePath, password, userId)
  .then(() => {
    console.log('Certificado cifrado y almacenado con éxito');
  })
  .catch(err => {
    console.error('Error al cifrar y almacenar el certificado', err);
  });

/*/

// Usar la clase CertificateManager para descifrar y guardar el archivo
const certificateId = '679f9dcaddb246cd2347c6ce';  // ID del certificado en la base de datos
const outputPath = './myDecryptedCert.p12';  // Ruta para guardar el archivo descifrado
const password = 'usuarioPassword123'; // Contraseña del usuario (se usará para derivar la clave)

CertificateManager.decryptAndRetrieveCertificate(certificateId, password, outputPath)
  .then(()=> {
    console.log('Certificado descifrado y guardado con éxito');
  })
  .catch(err => {
    console.error('Error al descifrar y guardar el certificado', err);
  });

