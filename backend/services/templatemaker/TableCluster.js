import CsvMaper from "./CsvMaper.js"; 
import ColSet from "./ColSet.js";

class  JsonTableCluster {
    constructor(arr_files) {
        this.jsontables = [];
        for (let file of arr_files)
            this.jsontables.push(new CsvMaper(file.path, file.name));
            

    }
    async init(props) {
        this.validateProperties(props);

        for (let table of this.jsontables) {
            await table.init(props[table.mapname].used_cols, props[table.mapname].groups);
        }

    }

    validateProperties(props) {//Change function
        for (const key in props) {
            if (
                typeof props[key] !== "object" ||
                !props[key].hasOwnProperty("used_cols") ||
                !props[key].hasOwnProperty("groups") ||
                typeof key !== "string" ||
                !Array.isArray(props[key].used_cols) ||
                !Array.isArray(props[key].groups)
            ) {
                let error_message =`Cada elemento de 'origin' debe tener la estructura:             
                "{
                    used_cols:[], 
                    groups:[]
                 }, \n`
                error_message+=`Proporcionado: ${JSON.stringify(props[key])}\n`
                throw new Error(error_message);
            }
        }
    }
} 

export default JsonTableCluster


// Usage:
if (import.meta.url === `file://${process.argv[1]}`) {


const testFunction = async () => {
    console.log("Testing");
    try {
        const cluster = new JsonTableCluster([{name:'Evaluaciones', path:'./evaluaciones.csv',},{name:'Becas',path:'./becas.csv'}]);
        for(let table of cluster.jsontables){
            const cols=await table.getCols();
        }

        const eva_cols = [
            'titulo_curso', 'nombres_completos_docente', 'NIVEL', 'id_banner_estudiante',
            'NRC', 'id_banner_docente', 'nota_parcial_1', 'nota_parcial_2',
            'nota_parcial_3', 'nota_exam_final', 'nota_final', 'estado', 'nombres_completos_estudiante'
        ]
        const beca_cols = [
            'ID', 'CATEGORIA_BECA_SOCIOECONOMICA', 'BECA_COMPLEMENTARIA', 'DESCRIPCION_BECA'
        ]
        const eva_groups=['id_banner_estudiante']
        const beca_groups= ['ID']

        //const props = [{name:'Evaluaciones',used_cols:eva_cols, groups:eva_groups}, {name:'Becas',used_cols:beca_cols,groups:beca_groups}];

        const props = {
            "Evaluaciones":{
                used_cols:eva_cols, 
                groups:eva_groups}, 
            "Becas":{
                used_cols:beca_cols,
                groups:beca_groups}
        };

        await cluster.init(props)
        console.log("Cluster")
        //console.log(cluster.jsontables[0].col_groups)

        const col_group= new ColSet(cluster.jsontables[1].col_sets['ID'])
        const col_group2= new ColSet(cluster.jsontables[0].col_sets['id_banner_estudiante'])

        console.log("joinGroupTables")
        col_group2.joinSetProps(col_group.col_set)
        //console.log(col_group2.table)
        const condition=[
            {col_name:'nota_parcial_1', rule:value => value <30},
            {col_name:'nota_parcial_2', rule:value => value <30},
            {col_name:'nota_parcial_3', rule:value => value <30},
            {col_name:'nota_exam_final', rule:value => value <20},
            {col_name:'nota_final', rule:value => value<30}
        ]

        


        const res1=col_group2.filterSetByORCondition(condition)
        //const res3=col_group2.filterSetByCondition('nota_parcial_3',condition)

        
        console.log("Resultado")
        console.log(res1)
        const filter_colset=new ColSet(res1)
        

    } catch (error) {
        console.error('Error en la ejecución:', error);
    }
};

testFunction();


}