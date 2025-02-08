import Groq from 'groq-sdk';

class ColSet {
    constructor(col_set) {
        this.col_set = {... col_set} 
        this.ia_model = new Groq({
            apiKey: process.env.GROQ_KEY || "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"
        });
    }



    joinSetProps(col_group_table) {
        for (let key in this.col_set) {
            if (col_group_table.hasOwnProperty(key)) {
                this.col_set[key].props ={...this.col_set[key].props, ...col_group_table[key].props} 
            }
        }
    }

    sendcoltoProperties(){

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
    filterSetByORCondition(array_condition){
        const filter_sets={}
        for(let condition of array_condition){
            filter_sets['filter_'+condition.col_name]=this.evalCondition(condition.col_name, condition.rule)
        }
        //this.deleteRowIfEmptyValue(filter_sets)
        console.log("Colsets")  //Para debuggear
        console.log(filter_sets.filter_nota_parcial_2.P00130306)

    }

    evalCondition(col_name, condition) {
        const new_col_set = {}
        for (let key in this.col_set) {
            const props=this.col_set[key].props
            if (props.hasOwnProperty(col_name)) {
                const cell_value = props[col_name];    
                if (condition(cell_value)&&cell_value!='') {
                    new_col_set[key] = this.col_set[key];
                }
            } else {
                new_col_set[key]={}
                new_col_set[key].props=this.col_set[key].props
                new_col_set[key].values = this.col_set[key].values.filter(row => {
                    if (row.hasOwnProperty(col_name)) {
                        const cell_value = row[col_name];
                        return cell_value!=''&&condition(cell_value); // Mantiene solo los que cumplen la condición
                    } else {
                        throw new Error(`col_name '${col_name}' not found in the csv file or table`);
                    }
                });
                if(!new_col_set[key].values.length)
                    delete new_col_set[key];

            }
        }
        return new_col_set;
    }
    

    joinSetByCondition(colset, condition) {
        
        
    }

    sendPropertietoCol(){

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

export default ColSet;