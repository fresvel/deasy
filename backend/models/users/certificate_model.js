import mongoose from 'mongoose';


const certificateSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
    filename: { type: String, required: true },
    certificateData: { type: Buffer, required: true },
    encryptionKey: { type: String, required: true }, // Si usas una clave de cifrado específica
    encryptionSalt: { type: String, required: true},
    createdAt: { type: Date, default: Date.now }
  });
  

  export const Certificate= mongoose.model('Certificate', certificateSchema);