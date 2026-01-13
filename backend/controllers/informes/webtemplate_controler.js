import { WebTemplate } from "../../models/informes/webtemplate_model.js";
import fs from "fs-extra"
/**
 * 1.- Load Files -- Not in report el template lo solicita como entrada  
 * 2.- Create Colsets -- In report is executed automatically
 * 3.- Filtrar colsets -- In report is executed automatically
 * 4.- Join Colsets -- In report is executed automatically (optional)
 * 5.- Update colsets -- In report is executed automatically (optional--computed)
 * 6.- Create colsections -- In report is executed automatically (optional--computed)
 * 7.- Transpile to latexjs object -- In report is executed automatically (optional--computed)
 * 8.- Add latexjs elements [from colsets?] -- In report is executed automatically (optional--computed)
 * 
 * On every status it is importan to save the status of the template.
 */

export const createWebTemplate = async (req, res)=>{

    console.log('Archivos recibidos:', req.files);  // 🚀 Verifica si Multer detecta archivos
    console.log(JSON.parse(req.body.jsonData)); //
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ message: 'No se subieron archivos' });
    }

    console.log("Creando Nuevo Template Web");
    try {
        const newtemplate= new WebTemplate(req.body);
        const ret = await newtemplate.save();
        console.log(ret);
        res.json({ result: "ok" });
    } catch (error) {
        console.log("Error Creating Template Web");
        console.error(error.message);
        return res.status(400).json({ message: "Error en la creación del webtemplate", error });
    }





    
}