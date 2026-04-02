import {getlowGrades} from "../../services/tutorias/getgrades_service.js"
import { deleteFile } from "../../utils/files.js";
export const informe_parcial =async (req, res)=>{

    if (!req.file) {
        return res.status(400).json({error: 'No file uploaded.'});
    }
    try {
        console.log("TESTING");
        console.log(req.file.path)
        const result=await getlowGrades(req.file.path)
        deleteFile(req.file.path)
        res.json(result);
        
    } catch (error) {
        console.log('Error al generar el informe parcial');
        console.error(error.message);   
        res.status(400).send({
            message: 'Error al generar el informe parcial',
            error: error.message
        });
        
    }

}
