import {ref} from "vue"
import axios from "axios"
import { API_ROUTES } from "./apiConfig";


class EasymServices {

    constructor() {
     
        
        this.file_grades=ref(null)
        this.file_tutorias=ref(null)
        this.levels=ref({})
        this.surveys=ref({})
        this.informe=ref({})

        this.programs=ref([])
        this.areas=ref([])
        this.tareas=ref([])

     
    }



    getEasymdata() {
        return {
            file_grades:this.file_grades,
            file_tutorias:this.file_tutorias, 
            levels:this.levels, 
            surveys:this.surveys,

            programs:this.programs,
            areas:this.areas,
            tareas:this.tareas,
        }
    }


    getEasymlevels(){
        return this.levels
    }
    getEasysurveys(){
        return this.surveys
    }


    async informeparcialTutorias(){
     try {
        
        const url=API_ROUTES.INFORME_TUTORIAS
        const formdata=new FormData();
        formdata.append('file',this.file_grades.value.files[0]);
        formdata.append('tutorias',this.file_tutorias.value.files[0]);
        console.log(this.file_grades.value.files[0])

        const res=await axios.post(url,formdata, {headers: {'Content-Type': 'multipart/form-data'}})

        console.log(res.data)

     } catch (error) {
        confirm(error.message)
        console.log(this.file_grades.value)
     }   
    }

    async generarReporte(){
        try {
            const url=API_ROUTES.GENERAR_REPORTE
            const formdata= new FormData();
            formdata.append('file',this.file_grades.value.files[0]);
            console.log("File");
            console.log(this.file_grades.value.files[0])
            

            const res=await axios.post(url,formdata, {headers: {'Content-Type': 'multipart/form-data'}})
            
    
    
            
            this.levels.value=res.data.table_logros
            this.surveys.value=res.data.logros_survey
            console.log(this.levels.value);
    
        } catch (error) {
            console.log(error.message)
            console.log(this.file_grades.value)
        }    
    }
    
    async obtenerReporte(){
      try {
            const url=API_ROUTES.OBTENER_REPORTE
            
            this.informe.value.content={tables:this.levels.value, surveys:this.surveys.value}
            const res=await axios.post(url,this.informe.value)
            console.log(res)
            window.open(res.data, '_blank');
    
        } catch (error) {
            console.log(error.message)
        }
    }

    async getEasymPrograms(){
        try {
            const url=API_ROUTES.PROGRAMS
            const res=await axios.get(url)
            this.programs.value=res.data.map(programa => {
                const {code, ...resto}=programa
                return {...resto, value: code}
            })
        } catch (error) {
            console.log(error.message)
            
        }

    }

    async getEasymAreas(){
        try {
            const url=API_ROUTES.AREAS
            const res=await axios.get(url)
            this.areas.value=res.data
        } catch (error) {
            console.log(error.message)
            
        }
    }

    async getTareasPendientes(user){
        try {
            console.log('📋 Obteniendo tareas para usuario:', user)
            const url=API_ROUTES.TAREAS_PENDIENTES(user)
            const res=await axios.get(url)
            this.tareas.value=res.data
            console.log("✅ Tareas obtenidas:", res.data)
            return res.data
        } catch (error) {
            console.log("❌ Error al obtener tareas")
            console.log(error.message)
            if(error.response) {
                console.log(error.response.data.message)
            }
        }
    }



}

export default EasymServices