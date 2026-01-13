import LatexEditor from "./editor/LatexEditor.js";

import LatexjsLibrary from "../../latexjslib/src/LatexjsLibrary.js";

import { LatexText } from "./transpiler/document/elements/LatexSections.js";



const llamar=async () => {

    const latextext=new LatexText();

    const tableData = {
        headers: [
            { content: "Materia", props: { multicolumn: false, multirow: false } },
            { content: "Docente", props: { multicolumn: false, multirow: false } },
            { content: "Nota 1", props: { multicolumn: false, multirow: false } },
            { content: "Nota 2", props: { multicolumn: false, multirow: false } },
            { content: "Resultado", props: { multicolumn: false, multirow: false } }
        ],
        rows: [
            [
                { content: "Álgebra Lineal", props: { multicolumn: false, multirow: false } },
                { content: "José Luis Carvajal", props: { multicolumn: false, multirow: false } },
                { content: "14", props: { multicolumn: 2, multirow: false } },
                {},
                { content: "37", props: { multicolumn: false, multirow: false } }
            ],
            [
                { content: "Matemática Básica", props: { multicolumn: false, multirow: false } },
                { content: "Ángel Anchundia", props: { multicolumn: false, multirow: false } },
                { content: "26", props: { multicolumn: false, multirow: false } },
                { content: "1", props: { multicolumn: false, multirow: false } },
                { content: "27", props: { multicolumn: false, multirow: false } }
            ],
            [
                { content: "Algoritmos y Pseudocódigo", props: { multicolumn: false, multirow: false } },
                { content: "Adrián Vargas", props: { multicolumn: false, multirow: false } },
                {content: "Adrián Vargas", props: { multicolumn: false, multirow: false } },
                { content: "21", props: { multicolumn: false, multirow: false } },
                { content: "49", props: { multicolumn: false, multirow: false } }
            ],
            [
                { content: "Comunicación Oral", props: { multicolumn: false, multirow: false } },
                { content: "Jairon Caballero", props: { multicolumn: false, multirow: false } },
                { content: "0", props: { multicolumn: false, multirow: false } },
                { content: "0", props: { multicolumn: false, multirow: false } },
                { content: "0", props: { multicolumn: false, multirow: false } }
            ],
            [
                { content: "Tecnologías de la Información", props: { multicolumn: false, multirow: false } },
                { content: "Manuel Nevárez", props: { multicolumn: false, multirow: false } },
                { content: "10", props: { multicolumn: false, multirow: false } },
                { content: "0", props: { multicolumn: false, multirow: false } },
                { content: "10", props: { multicolumn: false, multirow: false } }
            ]
        ],
        title: "Reporte de Calificaciones",
        caption: "Tabla que muestra las calificaciones de los estudiantes en diversas materias"
    };
        

    const json_era = {
        made: {
            name: "Homero Velasteguí",
            cargo: "Coordinador de Carrera"
        },
        reviewed: {
            name: "María Isabella",
            cargo: "Profesora de Matemática Básica"
        },
        approved: {
            name: "Pedro Antonio",
            cargo: "Coordinador de Tecnologías de la Información"
        }
    }

    const header={ 
        "programa":latextext.formatContent("Tecnología en Desarrollo & de Software"),
        "periodo":latextext.formatContent("2024-II"),
        "titulo":latextext.formatContent("Informe de \\ Tutorías")}



    const latexlib = new LatexjsLibrary();

    const latex_era = latexlib.create_latexEra(json_era);

    const json_header = latexlib.create_base_header(header);

    console.log(json_header);

    const modules={
            header:[
                {"type":"make", "content":json_header}
            ],
            body:[
                { "type": "section", "title": "Sección 1", "content": "Contenido de la sección 1" },
                { "type": "subsection", "title": "Subsección 1.1", "content": "Contenido de la subsección 1.1" },
                { "type": "subsubsection", "title": "Subsubsección 1.1.1", "content": "Contenido de la subsubsección 1.1.1" },
                { "type": "text", "content": "Este es un pálkjdjjhkajhdharrafo de texto que va después de la subsubsección." },
                { "type": "table", "content":tableData},
                { "type": "figure", "path": "image.png", "caption": "Figura 1. Ejemplo de imagen" },
                { "type": "section", "title": "Sección 2", "content": "Contenido de la sección 2" },
                { "type": "section", "title": "Sección 2", "content": "Contenido de la sección 2" },
                { "type": "section", "title": "Sección 2", "content": "Contenido de la sección 2" },
                { "type": "table", "content":latex_era},

            ],
            footer:[{}],
            preamble:[{}]
    }
        
    const informe = {
        "name": "salida2",// el filename debe ser único -- cuidado con inyección en signflow al crear los campos de firmas-- consultar BD
        "path": "/home/fresvel/Documentos/Pucese/deasy/backend/services/signflow/informes/ITI/2024/SPO2024/Academia/inicial",
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