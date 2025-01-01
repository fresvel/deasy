import { Informe } from "../../models/informes/informe_model.js";

export const createInforme = async (req, res) =>{
    console.log("Creando Nuevo Informe");
    try {
        const newInforme=new Informe(req.body);
        const ret = await newInforme.save();
        console.log(ret);
        res.json({ result: "ok" });
    } catch (error) {
        console.log("Error Creating Informe");
    }
}

export const getInforme = async (req, res) => {
    console.log("Buscando Informe por parametros");
    /**
     * Un informe es único bajo los siguientes parámetros
     * Año
     * Periodo
     * Programa
     * Proceso
     * Lo de abajo fue creado por tabnine
     */
    try {
        const informe = await Informe.find({props:{year:"2024", period:"02", program:"E055", process:"ac_cca_logros"}});
        if (!informe) {
            return res.status(404).json({ message: "Informe no encontrado" });
        }else if (informe.length > 1) {
            return res.status(400).json({ message: "Informe duplicado, notificar a admin del sistema" });
        }
        res.json(informe);
    } catch (error) {
        console.log("Error Buscando Informe por ID");
        res.status(500).json({ message: error.message });
    }
}