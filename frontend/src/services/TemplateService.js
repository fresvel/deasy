import {ref} from "vue"
import axios from "axios"

class TemplateService {
    constructor() {
        this.template = ref({})
        this.csv_files = ref(null)
    }

    async createTemplate(files, name){
        if (files.length === 0) {
            alert("No se han seleccionado archivos.");
            return;
        }
        try {
            const url = "http://localhost:3000/easym/v1/webtemplate"
            const formdata = new FormData();
            
            //const files = this.csv_files.value.files;
            for (let file of files) {
                formdata.append('files', file);
            }
    
            const dataJson = {
                name
            };

            console.log(dataJson);
    
            formdata.append('jsonData', JSON.stringify(dataJson));
    
            console.log("Archivos:");
            console.log(files); 
            
            const res = await axios.post(url, formdata, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });

            console.log(res);
        
        } catch (error) {
            console.log("Error:", error.message);
            //console.log("Archivos:", this.csv_files.value); // Información sobre los archivos seleccionados
        }
    }
    

}

export default TemplateService