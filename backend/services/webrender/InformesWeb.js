import csvtojson from 'csvtojson';
import Groq from 'groq-sdk';

class InformeWeb {
    constructor(csv_file, informe_format) {
        this.csv_file = csv_file;
        this.informe_format = informe_format;
        this.registros_json = [];
        this.informes = {}; 
        this.filtros = [
            'titulo_curso', 'nombres_completos_docente', 'NIVEL', 'id_banner_estudiante',
            'NRC', 'id_banner_docente', 'nota_parcial_1', 'nota_parcial_2',
            'nota_parcial_3', 'nota_exam_final', 'nita_final', 'estado', 'nombres_completos_estudiante'
        ];

        this.ia_model = new Groq({
            apiKey: process.env.GROQ_KEY || "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"
        });
    }

    async csvfileToJson() {
        try {
            const registro = await csvtojson({ delimiter: ';' }).fromFile(this.csv_file);
            this.registros_json = registro.map(item => this.filtrarCampos(item));
        } catch (error) {
            console.error('❌ Error al procesar el CSV:', error);
            throw error;
        }
    }

    filtrarCampos(item) {
        return this.filtros.reduce((obj, campo) => {
            if (item.hasOwnProperty(campo)) {
                obj[campo] = item[campo];
            }
            return obj;
        }, {});
    }

    async agruparPorCampo(column_name) {
        if (!this.registros_json.length)
         await this.csvfileToJson();
        
        this.informes[column_name] = this.registros_json.reduce((acc, registro) => {
            const key = registro[column_name] || 'Sin datos';
            if (!acc[key]) acc[key] = [];
            acc[key].push(registro);
            return acc;
        }, {});

        // Ordenar claves si es numérico
        const claves = Object.keys(this.informes[column_name]);
        if (claves.every(k => !isNaN(k))) {
            this.informes[column_name] = Object.fromEntries(
                claves.sort((a, b) => a - b).map(key => [key, this.informes[column_name][key]])
            );
        }

        

        for (let clave of claves) {
            this.informes[column_name][clave]=this.setProperties(this.informes[column_name][clave])
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

    async getIASurvey(prompt) {
        try {
            const chatCompletion = await this.ia_model.chat.completions.create({
                messages: [{ role: 'user', content: prompt }],
                model: 'llama3-8b-8192',
            });
            return chatCompletion.choices[0].message.content;
        } catch (error) {
            console.error('Error al llamar al modelo IA:', error);
            throw error;
        }
    }
}

class InformeTutorias extends InformeWeb {
    constructor(csv_file, informe_format) {
        super(csv_file, informe_format);
    }
}

const ejecutarInforme = async () => {
    try {
        const informe = new InformeTutorias('./evaluaciones.csv', 'formato');
        await informe.csvfileToJson();

        informe.agruparPorCampo('NIVEL');
        //console.log('Informe por Niveles:', informe.informes);

        informe.agruparPorCampo('id_banner_docente');

        informe.agruparPorCampo('id_banner_estudiante');
        informe.agruparPorCampo('NRC');
        //console.log('Informe por Docentes:', informe.informes);
        //const res=informe.setProperties();
        console.log('Informe de Resultados', informe.informes.NRC['7337']);

    } catch (error) {
        console.error('Error en la ejecución:', error);
    }
};

ejecutarInforme();
