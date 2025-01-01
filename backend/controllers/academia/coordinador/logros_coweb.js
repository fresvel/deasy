import { renderLogros } from "../../../services/academia/coordinador/render_logros.js";
import { deleteFile } from "../../../utils/files.js";

export const logros_coweb= async(req, res)=>{

  console.log("Controlador logros Web: ")
  console.log(req.file)

  if (!req.file) {
    console.log("Control error: no file found!");
    return res.status(400).json({error: 'No file uploaded'});
  }
  try {
    const json_logros=await renderLogros(req.file.path)
    console.log("JSON***************************************************")
    console.log(json_logros)
    console.log(req.file.path)
    deleteFile(req.file.path)
    res.json(json_logros) //json_logros debe ser almacenado en la base de datos. Es el informe
  } catch (error) {
    return res.status(400).json({
      message: 'Error al subir el archivo',
      error: error.message
    });
  }
}


