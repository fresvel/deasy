import MapFunctions from "./MapFunctions.js";
import CsvMapCluster from "./CsvMapCluster.js";
import fs from "fs-extra";

import SectionSet from "./SectionSet.js";

import LatexEditor from "../../latex/src/editor/LatexEditor.js";

import { LatexText } from "../../latex/src/transpiler/document/elements/LatexSections.js";
import LatexjsLibrary from "../../latexjslib/src/LatexjsLibrary.js";

import BodyReport from "./BodyReport.js";


class FileLoger {
    #deps
    constructor() {
        this.#deps = [
            `import MapFunctions from "./MapFunctions.js"`,
            `import CsvMapCluster from "./CsvMapCluster.js"`,
            `import fs from "fs-extra";`,
            `class MapRender{\n`
        ];
        this.textscript = ``;
        this.functions=[]
        this.callers = [
            `const caller=new MapRender()`
        ];
    }

    async FILE_LOG(fn, params) {

        if(typeof fn === "function"){
            this.functions.push(`${fn.toString()}`);
            this.callers.push(`await caller.${fn.name}(${params?JSON.stringify(params):''})`);
            fn(params);
        }
    }

    writeLogScrip(filename) {
        const template=`${this.#deps.join('\n')}${this.functions.join('\n')}}\n${this.callers.join('\n')}`
        fs.writeFileSync(filename, template);
        console.log("Archivo 'textscript.js' escrito con éxito.");
    }
}


class Ejemplo {
    async loadFiles(files) {
        const cluster = new CsvMapCluster(files);
        const cols = {};
        for (let mapkey in cluster.maps) {
            cols[mapkey] = await cluster.maps[mapkey].getCols();
        }
        return cols;
    }


    async reportExample(name, set, path="/home/fresvel/Documentos/Pucese/deasy/backend/services/signflow/informes/ITI/2024/SPO2024/Academia/inicial"){
        //console.log(name)
        //console.log(data)
                
        const informe = {
            "name": name, 
            "path": path,
            "modules": {},
            "template":"informe"
        };

        informe.modules={
            header:[],
            body:[],
            footer:[{}],
            preamble:[{}]
        }

        const latextext=new LatexText();
        const header={ 
            "programa":latextext.formatContent("Ingeniería en Tecnologías de la Información"),
            "periodo":latextext.formatContent("2024-II"),
            "titulo":latextext.formatContent("Informe de Tutorías")}

        const latexlib = new LatexjsLibrary();
        const json_header = latexlib.create_base_header(header);
        informe.modules.header.push({"type":"make", "content":json_header})

        
        const bd=new BodyReport("Semestre", "Este semestre !-id-! se tiene ")

        const body= await bd.getBody(set)

        informe.modules.body=body
        const latextmp=new LatexEditor(informe)
        console.log(informe.modules.body)
        //const latextmp=new LatexBuilder(latex_obj.template,latex_obj.name)
        await latextmp.cloneLatexProject();
        await latextmp.writeModules()
        const res=await latextmp.compile(informe.path)
        console.log("resultado: "+res)


    }

    async createReport (){

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


        
    async metodo() {
        const mapfunction = new MapFunctions();
        console.log("Testing");
        try {
            const files = [
                { name: 'Evaluaciones', path: './evaluaciones.csv' },
                { name: 'Becas', path: './becas.csv' },
                { name: 'Atenciones', path: './atenciones.csv' }
            ];


/**------------------Desde aquí se debe ejecutar el informe--------------------------- */
            const cluster = new CsvMapCluster(files);
            const cols = {};
            for (let mapkey in cluster.maps) {
                cols[mapkey] = await cluster.maps[mapkey].getCols();
            }

            //console.log("Cols Object");
            //console.log(cols)

            // Definimos las columnas necesarias para los conjuntos de datos
            const eva_cols = [
                'titulo_curso', 'nombres_completos_docente', 'NIVEL', 'id_banner_estudiante',
                'NRC', 'id_banner_docente', 'nota_parcial_1', 'nota_parcial_2','cod_programa_estudiante',
                'nota_parcial_3', 'nota_exam_final', 'nota_final', 'estado', 'nombres_completos_estudiante'
            ];
            const beca_cols = ['ID', 'CATEGORIA_BECA_SOCIOECONOMICA', 'BECA_COMPLEMENTARIA', 'DESCRIPCION_BECA'];
            const atention_cols=['NRC','ID_Alumno', 'Ambito', 'Tema', 'Comentarios', 'Acuerdos']

            const eva_col_sets = ['id_banner_estudiante'];
            const beca_col_sets = ['ID'];
            const atention_sets=['ID_Alumno']

            const props = {
                "Evaluaciones": { used_cols: eva_cols, col_set: eva_col_sets },
                "Becas": { used_cols: beca_cols, col_set: beca_col_sets },
                "Atenciones":{used_cols:atention_cols, col_set:atention_sets}// este file original da error por , vs ;
            };

            // Inicializamos el cluster con las propiedades definidas
            await cluster.init(props);
            console.log("Cluster Inited");            
            
            
            
            // Definimos los conjuntos de columnas y realizamos uniones
            const col_set_becas = cluster.maps.Becas.set_package['ID'];
            const col_set_eva = cluster.maps.Evaluaciones.set_package['id_banner_estudiante'];
            const col_set_atentions=cluster.maps.Atenciones.set_package['ID_Alumno']

            console.log("Joining col_sets...");
            col_set_eva.joinDataSetQuery(col_set_becas, 'Becas');

            //col_set_eva.joinDataSetQuery(col_set_atentions, 'Atenciones');


            console.log(col_set_eva.data)

            // Añadimos un valor calculado al conjunto de datos
            const params = ["nota_parcial_1", "nota_parcial_2", "nota_parcial_3", "nota_exam_final"];
            col_set_eva.addComputedValue('Media', mapfunction.getAverage, params);

            // Filtramos el conjunto de datos
            //const condiciones = [{ col_id: "Media", operador: "<", valor: 30 }];
            //let res = col_set_eva.filterSetbyOr(condiciones);
            //console.log(col_set_eva.data);
            //const condiciones = [{ col_id: "NIVEL", operador: "==", valor: 2 }];
            //const res = col_set_eva.filterSetbyOr(condiciones);
            console.log("+++++++++++++++++++++++++++++++++++++++++++++++")
            //condiciones.splice(0, condiciones.length)
            //condiciones.push({ col_id: 'cod_programa_estudiante', operador: "==", valor: "TE05" });
            //res=col_set_eva.filterPropsbyOr(condiciones)

            //const conditions=[{ col_id: "NIVEL", operador: "==", valor:"02"}]
            //const res=col_set_eva.filterPropsbyOr(conditions)

            //console.log(res);
            console.log("%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%")


            //const section_set=new SectionSet(res, 'NIVEL')
            const section_set=new SectionSet(col_set_eva.data, 'NIVEL')

            console.log("------------------------------------------------")
            console.log(section_set instanceof SectionSet); // true





            // Guardamos el resultado filtrado
            fs.writeFileSync("ayuda.json", JSON.stringify(section_set.sections));



            //Creación del informe 
            
            this.reportExample("Example",section_set)
            console.log(section_set.sections['02']["P00144398"].common)


            //this.holaMundo()

            









            console.log("Filtering...");

        } catch (error) {
            console.error('Error en la ejecución:', error);
        }
    }



}

const files = [
    { name: 'Evaluaciones', path: './evaluaciones.csv' },
    { name: 'Becas', path: './becas.csv' }
];

// Creamos una instancia del logger y de Ejemplo
const instancia = new Ejemplo();
//const logger = new FileLoger();

//logger.FILE_LOG(instancia.metodo);
//logger.writeLogScrip('textscript.js');

instancia.metodo()