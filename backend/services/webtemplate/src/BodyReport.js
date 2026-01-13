import SectionSet from "./SectionSet.js";
import ColSetAction from "./ColSetAction.js";
import { LatexText } from "../../latex/src/transpiler/document/elements/LatexSections.js";



import Groq from 'groq-sdk';

const groq = new Groq({
    apiKey: process.env['GROQ_API_KEY'], // This is the default and can be omitted
});



class BodyReport{
    #data
    constructor(set,label, desc){
        this.body=[]
        this.label=label
        this.desc=desc
        
    }

    async getBody(set){
        if(set instanceof SectionSet){
            this.#data=set.sections
            await this.#sectionSetToBody();
            return this.body
        }else if(set instanceof ColSetAction){
            console.log("Type 'ColSetAction'");
        }else {
            throw new Error(`El tipo ${typeof data} no es admitido para generar un body`);
        }
    }



    async #sectionSetToBody(){
        console.log("sectionSetToBody");
        for(let key in this.#data){
            const section=this.#data[key];
            this.body.push({
                "type": "section", 
                "title": `${this.label}: ${key}`, 
                "content": `${this.desc?this.desc.replace("!-id-!",key):""}`});
            await this.#sectionToTables(section);
        }
    }
    async #sectionToTables(section){
        for(let key in section){
            const col_set=section[key];
            this.body.push({
                "type": "table",  
                "content": this.#colsetToTable(col_set)
            });
            /*
            const beca=this.#propsTotext(col_set)
            if(beca!=''){
                this.body.push({
                    "type": "paragraph", 
                    "title": "Becas Asignadas",
                    "content":`${beca}` 
                })
            }

            
            const atten= await this.#commonTotext(col_set.common);
            this.body.push({
                "type": "paragraph", 
                "title": "Seguimiento Integral",
                "content":atten 
            })
            */



        }

    }


    #colsetToTable(col_set, col_ids=[
        {id:"titulo_curso", desc:"Materia"},
        {id:"nombres_completos_docente", desc:"Docente"},
        {id:"nota_parcial_1", desc:"N1"},
        {id:"nota_parcial_2", desc:"N2"},
        {id:"nota_parcial_3", desc:"N3"},
        {id:"nota_exam_final", desc:"Examen"},
        //{id:"nota_final", desc:"Promedio"},
        {id:"Media", desc:"Media"},
        {id:"estado", desc:"Estado"}
        ]){
        console.log("ColsetToTable");
        //console.log(col_set)
        const headers=[]
        for(let header of col_ids){
            headers.push({ content: header.desc, props: { multicolumn: false, multirow: false } })
        }

        const rows=[]
        for(let obj of col_set.values){
            const row =[]
            for (let cell of col_ids){
                row.push({ content: obj[cell.id]?obj[cell.id]:'-', props: { multicolumn: false, multirow: false } })
            }
            rows.push(row)
        }
        console.log("Rows: ")
        //console.log(rows)
        let title=`${col_set.props['nombres_completos_estudiante']}`

        return {
            "headers": headers,
            "rows": rows,
            "title": title,
            "caption":""
        }
    }

    #propsTotext(col_set){

        let beca=''
        if(col_set.props['DESCRIPCION_BECA']){
            beca = `${col_set.props['DESCRIPCION_BECA']}`
        }
        if(col_set.props['BECA_COMPLEMENTARIA']){
            beca += `\nComplementaria: ${col_set.props['BECA_COMPLEMENTARIA']}`
        }
        if (col_set.props['CATEGORIA_BECA_SOCIOECONOMICA']){
            beca += `\nCategoría: ${col_set.props['CATEGORIA_BECA_SOCIOECONOMICA']}`
        }
        //const ltext = new LatexText(beca)
        //beca = ltext.formatContent(beca)
        //console.log("Beca: ++++++++++++++++++++++++++++++++++++++++++")
        //console.log(beca)
        return beca
    }

    async #commonTotext(data){
        console.log("Beca: +++++++++++++++++++++++++++++++++++++++++?")
        console.log(data)

        const chatCompletion = await groq.chat.completions.create({
          messages: [{ role: 'user', content: `${data.Atenciones}
            Los datos dados pertenecen al los registros de tutorías de  un estudiante que reprobó alguna asignatura. Haz un análisis concreto de la atención entregada en dos párrafos` }],
          model: 'llama3-8b-8192',
        });
      
        console.log(chatCompletion.choices[0].message.content);
        return chatCompletion.choices[0].message.content
    }

    
}




export default BodyReport;
