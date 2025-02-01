import LatexBuilder from "./builder/LatexBuilder.js";
import LatexEditor from "./editor/LatexEditor.js";

const llamar=async () => {
        
        const modules={
            header:[{}],
            body:[
                { "type": "section", "title": "Sección 1", "content": "Contenido de la sección 1" },
                { "type": "subsection", "title": "Subsección 1.1", "content": "Contenido de la subsección 1.1" },
                { "type": "subsubsection", "title": "Subsubsección 1.1.1", "content": "Contenido de la subsubsección 1.1.1" },
                { "type": "text", "content": "Este es un pálkjdjjhkajhdharrafo de texto que va después de la subsubsección." },
                { "type": "table", "headers": ["Header 1", "Header 2", "Header 3"],"title":"Titulo largo para escribir", "rows": [["A1", "B1", "C1"], ["A2", "B2", "C2"]], "caption": "Descripción de la tabla"},
                { "type": "figure", "path": "image.png", "caption": "Figura 1. Ejemplo de imagen" },
                { "type": "section", "title": "Sección 2", "content": "Contenido de la sección 2" },
                { "type": "section", "title": "Sección 2", "content": "Contenido de la sección 2" },
                { "type": "section", "title": "Sección 2", "content": "Contenido de la sección 2" }
            ],
            footer:[{}],
            preamble:[{}]
        }
        
        const informe = {
            "name": "logrosac2024S2",// el filename debe ser único
            "path": "/home/fresvel/Documentos/Pucese/deasy/backend/services/signflow/informes/ITI/2024/SPO2024/Academia/elaborados",
            "modules": modules,
            "template":"informe"
        };

        const latextmp=new LatexEditor(informe)
        //const latextmp=new LatexBuilder(latex_obj.template,latex_obj.name)
        await latextmp.cloneLatexProject();
        await latextmp.writeModules()
        const res=await latextmp.compile(informe.path)
        console.log("resultado: "+res)
    }

llamar()


/**
 * Recibe objeto JSON desde el controlador (Web) *** Todo el contendo ya debe venir en el json_obj
 * Crea una instancia del informe y copia el template
 * gestiona los módulos para enviar a transpilarlos
 * transpila los elementos recibidos para pasarle al editor
 * llama a editor para editar elemento del template
 * llama a editor para editar otro elemento del template
 * llama a compile para generar el archivo final
 * 
 * Ejemplo del JSON:
 * {
 *      "name": "nombre del proyecto o informe", //manejar en gestión de informes nuevos
        "path": "/home/fresvel/Documentos/Pucese/deasy/backend/services/signflow/informes/ITI/2024/SPO2024/Academia/elaborados",
        "modules": modules, //Array de objetos que se deben pasar al editor
        "template":"informe"
 * }
   modules={
        header:[{}]
        body:[{}],
        footer:[{}]
    }

    { "type": "section", "title": "Sección 1", "content": "Contenido de la sección 1" },
    { "type": "subsection", "title": "Subsección 1.1", "content": "Contenido de la subsección 1.1" },
    { "type": "subsubsection", "title": "Subsubsección 1.1.1", "content": "Contenido de la subsubsección 1.1.1" },
    { "type": "text", "content": "Este es un pálkjdjjhkajhdharrafo de texto que va después de la subsubsección." },
    { "type": "table", "headers": ["Header 1", "Header 2", "Header 3"],"title":"Titulo largo para escribir", "rows": [["A1", "B1", "C1"], ["A2", "B2", "C2"]], "caption": "Descripción de la tabla"},
    { "type": "figure", "path": "path/to/image.jpg", "caption": "Figura 1. Ejemplo de imagen" },
    { "type": "section", "title": "Sección 2", "content": "Contenido de la sección 2" },
    { "type": "section", "title": "Sección 2", "content": "Contenido de la sección 2" },
    { "type": "section", "title": "Sección 2", "content": "Contenido de la sección 2" }

 */