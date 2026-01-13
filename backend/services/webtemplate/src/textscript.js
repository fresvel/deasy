import MapFunctions from "./MapFunctions.js"
import CsvMapCluster from "./CsvMapCluster.js"
import fs from "fs-extra";
class MapRender{
async metodo() {
        const mapfunction = new MapFunctions();
        console.log("Testing");
        try {
            const files = [
                { name: 'Evaluaciones', path: './evaluaciones.csv' },
                { name: 'Becas', path: './becas.csv' }
            ];
/**------------------Desde aquí se debe ejecutar el informe--------------------------- */
            const cluster = new CsvMapCluster(files);
            const cols = {};
            for (let mapkey in cluster.maps) {
                cols[mapkey] = await cluster.maps[mapkey].getCols();
            }

            console.log("Cols Object");

            // Definimos las columnas necesarias para los conjuntos de datos
            const eva_cols = [
                'titulo_curso', 'nombres_completos_docente', 'NIVEL', 'id_banner_estudiante',
                'NRC', 'id_banner_docente', 'nota_parcial_1', 'nota_parcial_2',
                'nota_parcial_3', 'nota_exam_final', 'nota_final', 'estado', 'nombres_completos_estudiante'
            ];
            const beca_cols = ['ID', 'CATEGORIA_BECA_SOCIOECONOMICA', 'BECA_COMPLEMENTARIA', 'DESCRIPCION_BECA'];
            const eva_col_sets = ['id_banner_estudiante'];
            const beca_col_sets = ['ID'];

            const props = {
                "Evaluaciones": { used_cols: eva_cols, col_set: eva_col_sets },
                "Becas": { used_cols: beca_cols, col_set: beca_col_sets }
            };

            // Inicializamos el cluster con las propiedades definidas
            await cluster.init(props);
            console.log("Cluster Inited");

            // Definimos los conjuntos de columnas y realizamos uniones
            const col_set_becas = cluster.maps.Becas.set_package['ID'];
            const col_set_eva = cluster.maps.Evaluaciones.set_package['id_banner_estudiante'];

            console.log("Joining col_sets...");
            col_set_eva.joinDataSetQuery(col_set_becas, 'Becas');

            // Añadimos un valor calculado al conjunto de datos
            const params = ["nota_parcial_1", "nota_parcial_2", "nota_parcial_3", "nota_exam_final"];
            col_set_eva.addComputedValue('Media', mapfunction.getAverage, params);

            // Filtramos el conjunto de datos
            const condiciones = [{ col_id: "Media", operador: "<", valor: 30 }];
            const res = col_set_eva.filterSetbyOr(condiciones);

            console.log("------------------------------------------------")

            const section_set=new SectionSet(res, 'NIVEL')

            // Guardamos el resultado filtrado
            fs.writeFileSync("ayuda.json", JSON.stringify(section_set));



            //Creación del informe 
            
            //this.reportExample("Example",section_set)
            holaMundo()

            









            console.log("Filtering...");

        } catch (error) {
            console.error('Error en la ejecución:', error);
        }
    }}
const caller=new MapRender()
await caller.metodo()