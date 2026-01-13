import Groq from 'groq-sdk';
import fs from 'fs-extra';

class ColSetAction {
    #operadores
    constructor(col_set) {
        this.data = {... col_set} 
        this.#operadores = {
            "<":  (a, b) => a < b,
            "<=": (a, b) => a <= b,
            ">":  (a, b) => a > b,
            ">=": (a, b) => a >= b,
            "==": (a, b) => a == b,  // O estrictamente (===)
            "===": (a, b) => a === b,
            "!=": (a, b) => a != b,  // O estrictamente (!==)
            "!==": (a, b) => a !== b
          };
        
        /*
        this.ia_model = new Groq({
            apiKey: process.env.GROQ_KEY
        });*/
    }


    joinDataSetQuery(col_data_set, common='') {
        console.log("Quering data set");
        if(Object.keys(this.data).length){
            for (let value in this.data) { 
                if (col_data_set.data[value]?.hasOwnProperty("props")) {
                    this.data[value].props = {
                        ...this.data[value].props, 
                        ...col_data_set.data[value].props
                    };
                    if(common!=''){
                        if (!this.data[value].common) this.data[value].common={}
                        this.data[value].common[common]=col_data_set.data[value].values||[];                        
                    }
                }
            }
        }else{
            console.log("Origin data sets are empty")
        }
        return this;
    }

    filterSetbyOr(condiciones) {
        const resultado = {};
        for (const [set_id, data_set] of Object.entries(this.data)) {
          const filters = data_set.values.filter(row => {
            return condiciones.some(cond => {
              const col_id = cond.col_id;
              const rawValor = row[col_id];
              
              if (rawValor === "") return false;
              
              const valor = parseFloat(rawValor);
              const operacion = this.#operadores[cond.operador];
              
              if (typeof operacion !== "function") {
                console.error(`Operador inválido: ${cond.operador}`);
                return false;
              }
              
              return operacion(valor, cond.valor);
            });
          });
      
          if (filters.length > 0) {
            resultado[set_id] = {
              ...data_set,
              values: filters
            };
          }
        }
      
        this.data = resultado;
        return resultado;
    }

    filterSetbyAnd(condiciones) {
        const resultado = {};
        for (const [set_id, data_set] of Object.entries(this.data)) {
          const filters = data_set.values.filter(row => {
            return condiciones.every(cond => {
              const col_id = cond.col_id;
              const rawValor = row[col_id];
              
              if (rawValor === "") return false;
              
              const valor = parseFloat(rawValor);
              const operacion = this.#operadores[cond.operador];
              
              if (typeof operacion !== "function") {
                console.error(`Operador inválido: ${cond.operador}`);
                return false;
              }

              return operacion(valor, cond.valor);
            });
          });
      
          if (filters.length > 0) {
            resultado[set_id] = {
              ...data_set,
              values: filters
            };
          }
        }
      
        this.data = resultado;
        return resultado;
    }

    addComputedValue(col_name, callback, params) {
        console.log("Adding Computed Value");
        for (const key in this.data) {
            if (this.data.hasOwnProperty(key)) {
              const register = this.data[key];
              if (Array.isArray(register.values)) {
                register.values.forEach(row => {
                  row[col_name] = callback(row, params, register);
                });
              }
            }
          }
          return this.data;
      }




    filterPropsbyOr(conditions){
      const resultado =Object.fromEntries( 
        Object.entries(this.data).filter(([key, set]) =>{
          return conditions.some(cond =>{
            const prop=cond.col_id
            const ref=cond.valor
            const value=set.props[prop]

            const operacion=this.#operadores[cond.operador]
            if (typeof operacion!== "function") {
              console.error(`Operador inválido: ${cond.operador}`);
              return false;
            }
            console.log(operacion.toString())
            console.log("A: "+ref)
            console.log("B: "+value)
            console.log("Res:"+ operacion(value,ref))
            return operacion(value,ref)
          }
        )})
      )
      this.data = resultado
      return resultado
  }


    joinSetByCondition(colset, condition) {
        
        
    }

    sendPropertietoCol(){

    }

    deleteRowIfEmptyValue(col_sets){
        for (let key in col_sets){
            const col_set=col_sets[key]
            for (let value in col_set){
                const props=col_set[value].props
                const values=col_set[value].values
                //console.log(values)
                for(let key in props){
                    if(props[key]==='')
                        delete props[key]
                }
                for (let row of values){
                    for(let cell_key in row){
                        if(row[cell_key]==='')
                            delete row[cell_key]
                    }
                }
                if(!Object.keys(props).length &&!values.length)
                    delete col_sets[col_set][col_unic]
            }
        }

    }
    sendcoltoProperties(){

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

export default ColSetAction;
