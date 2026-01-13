import csvtojson from 'csvtojson';
import ColSetAction from './ColSetAction.js';

class CsvMaper {
    constructor(csv_path,mapname) {
        this.csv_path = csv_path;
        this.mapname=mapname
        this.rows = []; 
        this.all_cols=[];
        this.used_cols = ['There are no cols selected!']; 
        this.set_package = {};
    }

    async init(used_cols, colset_names) {
        try {
            this.used_cols=used_cols
            const rows_csv_json = await csvtojson({ delimiter: ';' }).fromFile(this.csv_path);
            this.rows = rows_csv_json.map(row => this.#filterCols(row));
            
            for(let colname of colset_names) {
                await this.#buildSetInPackage(colname);
            }
        } catch (error) {
            console.error('❌ Error al procesar el CSV:', error);
            throw error;
        }
    }

    #filterCols(row) {
        return this.used_cols.reduce((obj, used_col) => {
            if (row.hasOwnProperty(used_col)) {
                obj[used_col] = row[used_col];
            }
            return obj;
        }, {});
    }

    async #buildSetInPackage(col_id) {
        console.log(`Building set ${col_id} in package`)
        const row_set = this.rows.reduce((acc, registro) => {
            const key = registro[col_id] || 'Sin datos';
            if (!acc[key]) acc[key] = [];
            acc[key].push(registro);
            return acc;
        }, {});
        const col_set={}
        for (let data_set in row_set) {
            col_set[data_set]=this.#formatDataset(row_set[data_set])
        }
        this.set_package[col_id]=new ColSetAction(col_set)
    }

    #formatDataset(row_set){
        const props={}
        let values=[]
        const base=row_set[0]
        for (let key in base){
            const is_common=row_set.every(registro=>registro[key]===base[key])
            if (is_common){
                props[key]=base[key]
            }
        }

        values=row_set.map(registro=>{
            let registro_filtrado={...registro}
            for (let key in props){
                delete registro_filtrado[key]
            }
            return registro_filtrado
        })
        return {props,values}    
    }

    async getCols() {
        try {
            const registro = await csvtojson({ delimiter: ';' }).fromFile(this.csv_path);
            this.all_cols=[... Object.keys(registro[0])]
            return this.all_cols
        } catch (error) {
            console.error('❌ Error al procesar el CSV:', error);
            throw error;
        }
    }
}
export default CsvMaper




/**TESTING */
if (import.meta.url === `file://${process.argv[1]}`) {


    const ejecutarInforme = async () => {
        try {
            console.log("Informe de Evaluaciones");
            const table = new CsvMaper('./evaluaciones.csv', 'Evaluaciones');
            const cols= await table.getCols();    
    
            const filtered_cols = [
                'titulo_curso', 'nombres_completos_docente', 'NIVEL', 'id_banner_estudiante',
                'NRC', 'id_banner_docente', 'nota_parcial_1', 'nota_parcial_2',
                'nota_parcial_3', 'nota_exam_final', 'nita_final', 'estado', 'nombres_completos_estudiante'
            ]
            
            const groups = ['id_banner_estudiante']
    
            await table.init(filtered_cols, groups); //enviar también los grupos que se desean analizar
    
            console.log('Groups', table.set_package);
    
        } catch (error) {
            console.error('Error en la ejecución:', error);
        }
    };

    
    console.log("Ejecutando como script principal");
    ejecutarInforme();
}
