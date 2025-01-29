/**
 * Obtener desde la base de datos la plantilla del informe
 * La plantilla del informe es una función almacenada en la base de datos
 * antes de su ejecución se valida el hash almacenado con un hash calculado
 * el hash calculado es un sha del código mas una clave secreta almacenada en 
 * las variables de entorno.
 * Para almacenar una nueva función se crea una aplicación que recibe el código
 * y un hash calculado que devuelve un autorizador. El hash del autorizador
 * se calcula con el código fuente mas una clave del autorizador.
 * Finalmente para guardar la nueva función se valida el hash del 
 * archivo con la clave del usuario mas el hash del archivo con la clave
 * del autorizador y si coicide se procede a almacenar. El hash final del código que se 
 * almacena para la validación de confiabilidad no se devuelve al usuario bajo ninguna 
 * circunstancia. Posible MQTT para manejar las claves 
 * Obtener desde el req el json de información
 * Renderizar la plantilla con el json
 */


import { compileLatexjs } from '../utils/latex.js';
import { Template } from '../models/informes/templates.js';
import { dailc_va } from '../templates/javascript/dailc_va.js';


const fntemplates = {dailc_va}

export const logroscJslatex= async(req, res, next)=>{
    
    const tables=req.body.content.tables;
    const surveys=req.body.content.surveys;
    console.log("New report required");
    const report_template=await Template.find({code:"dailc_v1"}) //Note implemted yet
    

    /**Preproceso con base de datos */
    const latexfile=fntemplates["dailc_va"](tables, surveys)
    console.log(latexfile)
    
    try {
      await compileLatexjs({name:"itilc_2024_ii",content:latexfile}); // Invoca la función y espera a que se complete
      req.url=`http://localhost:${process.env.PORT}/itilc_2024_ii.pdf`
      next(); // Llama al siguiente middleware solo después de que compileLatexjs haya terminado
    } catch (error) {
      console.error('Error en compileLatexjs:', error);
      next(error); // Pasa el error al siguiente middleware de manejo de errores
    }
}
















