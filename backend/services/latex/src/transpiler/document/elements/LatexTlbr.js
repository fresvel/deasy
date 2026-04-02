class LatexTlbr{
    #inner
    #outer
    #body
    constructor(outer, inner, body){
        this.#inner = '';
        this.#outer = '';
        this.#body = '';
        this.#buildOuter(outer);
        this.#buildInner(inner);
        this.#buildBody(body);
        this.#render();
        this.latex=''
    }
    #buildOuter(){

    }
    #buildInner(inner){
        if(!inner.hlines) inner.hlines='hlines';
        if(!inner.vlines) inner.vlines='vlines';
        //if(!inner.colspec) inner.colspec='colspec';
        for(let conf in inner){
            this.#inner+=`${inner[conf]},\n`
        }

    }
    #buildBody(body) {
        let colspec = [];  
    
        for (let row of body) {
            const keys = Object.keys(row);
    
            for (let i = 0; i < keys.length; i++) {
                let col = keys[i];
                const text = row[col].toString();
                const text_size = text.length;
                const word_size = this.#getLargestWord(text);
    
                if (!colspec[i]) {
                    colspec[i] = {  
                        text_size: text_size, 
                        word_size: word_size
                    };
                } else {
                    if (text_size > colspec[i].text_size) {
                        colspec[i].text_size = text_size;
                    }
                    if (word_size > colspec[i].word_size) {
                        colspec[i].word_size = word_size;
                    }
                }
    
                this.#body += `{${this.toTitleCase(text)}}`;
    
                if (i < keys.length - 1) this.#body += ` & `;
            }
    
            this.#body += `\\\\\n`;
        }
    
        console.log('Palabras más grandes en cada columna:', colspec);
        this.#inner += `colspec={`
        for(let col of colspec) {
            //this.#inner += `|X[${col.text_size*0.1+col.word_size*0.9}]|`;
            this.#inner += `X[${col.word_size}${colspec.length>=10?', font=\\normalsize':''}]`;
        }
        this.#inner += `}`
    }
    
    toTitleCase(str) {
        return str
          .split(' ')
          .map(word => {
            if (word.includes('-')) {
              return word.split('-').map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()).join('-');
            }
            return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
          })
          .join(' ');
      }      


    #getLargestWord(text) {
        const words = text.split(/\s+/);
        
        let largestWord = '';
        let largestSize = 0;
    
        words.forEach(word => {
            const wordSize = word.length;
    
            if (wordSize > largestSize) {
                largestWord = word;
                largestSize = wordSize;
            }
        });

        return largestSize;
    }    



    #render(){
        this.latex= `\\begin{longtblr}[${this.#outer}]{${this.#inner}}\n${this.#body}\n\\end{longtblr}`;
        console.log(this.latex)
        return this.latex
    }
}

const inner=''
const outer='%hlines,vlines,caption=true,label=tab:my_long_table'

const body=[
    {"titulo_curso":"Materia","nombres_completos_docente":"Docente","NRC":"NRC","id_banner_docente":"Id Docente","nota_parcial_1":"N1","nota_parcial_2":"N2","nota_parcial_3":"N3","nota_exam_final":"NE","nota_final":"NF","estado":"Estado","Media":"Media"},
    {"titulo_curso":"Estructuras Discretas","nombres_completos_docente":"CARVAJAL CARVAJAL JOSE LUIS","NRC":"3616","id_banner_docente":"P00066752","nota_parcial_1":"17","nota_parcial_2":"0","nota_parcial_3":"0","nota_exam_final":"0","nota_final":"4","estado":"REPROBADO","Media":"4.25"},
    {"titulo_curso":"Redes","nombres_completos_docente":"VARGAS MACHUCA DEL SALTO ADRIAN GABRIEL","NRC":"3619","id_banner_docente":"P00164919","nota_parcial_1":"16","nota_parcial_2":"33","nota_parcial_3":"1","nota_exam_final":"1","nota_final":"13","estado":"REPROBADO","Media":"12.75"},
    {"titulo_curso":"Prácticas Servicio Comunitario","nombres_completos_docente":"NEVAREZ TOLEDO MANUEL ROGELIO","NRC":"3620","id_banner_docente":"P00067405","nota_parcial_1":"0","nota_parcial_2":"0","nota_parcial_3":"0","nota_exam_final":"0","nota_final":"0","estado":"REPROBADO","Media":"0.00"}]
const tlbr=new LatexTlbr({},{},body)

console.log(tlbr)