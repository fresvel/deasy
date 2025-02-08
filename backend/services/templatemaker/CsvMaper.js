import csvtojson from 'csvtojson';

class CsvMaper {
    constructor(csv_path,mapname) {
        this.csv_path = csv_path;
        this.mapname=mapname
        this.rows = []; 
        this.all_cols=[];
        this.used_cols = ['There are no cols selected!']; 
        this.col_sets = {};
    }

    async init(used_cols, groups) {
        //console.log(used_cols)
        //console.log(groups)
        this.used_cols=used_cols
        try {
            const array_csv_json = await csvtojson({ delimiter: ';' }).fromFile(this.csv_path);
            this.rows = array_csv_json.map(row => this.filterCols(row));
        } catch (error) {
            console.error('❌ Error al procesar el CSV:', error);
            throw error;
        }

        for(let col of groups) {
            await this.groupbyCol(col);
        }
    }

    filterCols(row) {
        return this.used_cols.reduce((obj, used_col) => {
            if (row.hasOwnProperty(used_col)) {
                obj[used_col] = row[used_col];
            }
            return obj;
        }, {});
    }

    async groupbyCol(col_name) {
        
        if (!this.rows.length)
         await this.csvfileToJson();
        
        this.col_sets[col_name] = this.rows.reduce((acc, registro) => {
            const key = registro[col_name] || 'Sin datos';
            if (!acc[key]) acc[key] = [];
            acc[key].push(registro);
            return acc;
        }, {});

        const claves = Object.keys(this.col_sets[col_name]);
        if (claves.every(k => !isNaN(k))) {
            this.col_sets[col_name] = Object.fromEntries(
                claves.sort((a, b) => a - b).map(key => [key, this.col_sets[col_name][key]])
            );
        }

        for (let clave of claves) {
            this.col_sets[col_name][clave]=this.setProperties(this.col_sets[col_name][clave])
        }
    }



    setProperties(column_filtered){
        const props={}
        let values=[]
        const base=column_filtered[0]
        for (let key in base){
            const is_common=column_filtered.every(registro=>registro[key]===base[key])
            if (is_common){
                props[key]=base[key]
            }
        }

        values=column_filtered.map(registro=>{
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
    
            console.log('Groups', table.col_sets);
    
        } catch (error) {
            console.error('Error en la ejecución:', error);
        }
    };

    
    console.log("Ejecutando como script principal");
    ejecutarInforme();
}
