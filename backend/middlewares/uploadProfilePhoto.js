import multer from "multer";
import path from "path";
import fs from "fs-extra";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadsRoot = path.resolve(process.cwd(), "uploads");
const profilePhotosDir = path.join(uploadsRoot, "profile_photos");

fs.ensureDirSync(profilePhotosDir);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, profilePhotosDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const safeExt = [".png", ".jpg", ".jpeg", ".webp"].includes(ext) ? ext : ".png";
    const identifier = (req.params?.cedula || "user").replace(/[^a-zA-Z0-9_-]/g, "");
    const timestamp = Date.now();
    cb(null, `${identifier}_${timestamp}${safeExt}`);
  }
});

const fileFilter = (_req, file, cb) => {
  const allowed = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Formato de imagen no permitido. Usa PNG, JPG o WEBP."));
  }
};

export const profilePhotoRelativePath = (filename) =>
  path.posix.join("uploads", "profile_photos", filename);

export const uploadProfilePhoto = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5 MB
  }
});
