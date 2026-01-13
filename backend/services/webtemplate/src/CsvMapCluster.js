import CsvMaper from "./CsvMaper.js"; 
import ColSetAction from "./ColSetAction.js";
import fs from "fs-extra";
import MapFunctions from "./MapFunctions.js";

class  CsvMapCluster {
    constructor(arr_files) {
        this.maps = {};
        for (let file of arr_files)
            this.maps[file.name]=new CsvMaper(file.path, file.name)
    }
    async init(props) {
        this.validateProperties(props);

        for (let mapkey in this.maps) {
            console.log("MAP key: ");
            console.log(mapkey);
            console.log(props[mapkey].used_cols)
            console.log(props[mapkey].col_set)
            await this.maps[mapkey].init(props[mapkey].used_cols, props[mapkey].col_set);
            console.log(this.maps[mapkey])
        }

    }

    validateProperties(props) {//Change function
        for (const key in props) {
            if (
                typeof props[key] !== "object" ||
                !props[key].hasOwnProperty("used_cols") ||
                !props[key].hasOwnProperty("col_set") ||
                typeof key !== "string" ||
                !Array.isArray(props[key].used_cols) ||
                !Array.isArray(props[key].col_set)
            ) {
                let error_message =`Cada elemento de 'origin' debe tener la estructura:             
                "{
                    used_cols:[], 
                    col_set:[]
                 }, \n`
                error_message+=`Proporcionado: ${JSON.stringify(props[key])}\n`
                throw new Error(error_message);
            }
        }
    }
} 

export default CsvMapCluster


// Usage:
if (import.meta.url === `file://${process.argv[1]}`) {

const testFunction = async () => {

    const mapfunction=new MapFunctions()
    console.log("Testing");
    try {
        const files = [
            {name: 'Evaluaciones', path: './evaluaciones.csv'},
            {name: 'Becas', path: './becas.csv'}
        ];

        const cluster = new CsvMapCluster(files);
        const cols={};
        for(let mapkey in cluster.maps){
            cols[mapkey]=await cluster.maps[mapkey].getCols();
        }
        console.log("Cols Object")
        //console.log(cols)

        const eva_cols = [
            'titulo_curso', 'nombres_completos_docente', 'NIVEL', 'id_banner_estudiante',
            'NRC', 'id_banner_docente', 'nota_parcial_1', 'nota_parcial_2',
            'nota_parcial_3', 'nota_exam_final', 'nota_final', 'estado', 'nombres_completos_estudiante'
        ]
        const beca_cols = [
            'ID', 'CATEGORIA_BECA_SOCIOECONOMICA', 'BECA_COMPLEMENTARIA', 'DESCRIPCION_BECA'
        ]
        const eva_col_sets=['id_banner_estudiante']
        const beca_col_sets= ['ID']

        //const props = [{name:'Evaluaciones',used_cols:eva_cols, groups:eva_groups}, {name:'Becas',used_cols:beca_cols,groups:beca_groups}];

        const props = {
            "Evaluaciones":{
                used_cols:eva_cols, 
                col_set:eva_col_sets}, 
            "Becas":{
                used_cols:beca_cols,
                col_set:beca_col_sets}
        };

        await cluster.init(props)
        console.log("Cluster Inited")
        
        
        const col_set_becas= cluster.maps.Becas.set_package['ID']
        //console.log(col_set_becas.data['P00149370'])
        
        
        const col_set_eva= cluster.maps.Evaluaciones.set_package['id_banner_estudiante']
        //console.log(col_set_eva)

        
        console.log("joining col_sets...")
        //console.log(col_set_eva)
        col_set_eva.joinDataSetQuery(col_set_becas,'Becas')
        //console.log(col_set_eva.data['P00149370'].common)



        const params = ["nota_parcial_1", "nota_parcial_2", "nota_parcial_3","nota_exam_final"]
        col_set_eva.addComputedValue('Media',mapfunction.getAverage,params)
        console.log(col_set_eva.data['P00111056'])
        

        /*
        const condiciones = [
            { col_id: "nota_parcial_1", operador: "<", valor: 30 },
            { col_id: "nota_parcial_2", operador: "<", valor: 30 },
            { col_id: "nota_parcial_3", operador: "<", valor: 30 }
        ];*/

        console.log("------------------------------------------------")

        const condiciones = [
            { col_id: "Media", operador: "<", valor: 29.5 }]
        const res=col_set_eva.filterSetbyOr(condiciones)
        //console.log(res)
        
        fs.writeFileSync("ayuda.json",JSON.stringify(res))

        
        console.log("Filtering...")

    } catch (error) {
        console.error('Error en la ejecución:', error);
    }
};

testFunction();




}