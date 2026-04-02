import LatexComponet from "../../LatexComponet.js";

class LatexTabularx extends LatexComponet  {
    constructor(content) {
        super();
        this.headers = content.headers;
        this.rows = content.rows;
        this.title = content.title;
        this.caption = content.caption;
    }

    generateColumnFormat() {
        //return "|" + this.headers.map(() => "X").join("|") + "|";
        //return "|" + this.headers.map((_, i) => (i < 2 ? "p{3cm}" : "X")).join("|") + "|";
        return "|" + this.headers.map((_, i) => {
            if(i==7) return "p{2.25cm}";
            if (i < 2) return "p{3cm}";
            if (i > 4) return "p{1.5cm}";
            
            return "X";
          }).join("|") + "|";

    }

    renderTitle() {
        return this.title
            ? `\\multicolumn{${this.headers.length}}{|c|}{\\textbf{${this.title}}}\\\\\\hline\n`
            : "";
    }

    renderHeaders() {
        return this.headers
            .map(({ content, props }) => {
                if (props?.multicolumn && props.multicolumn > 1) {
                    return `\\multicolumn{${props.multicolumn}}{|c|}{\\textbf{${content}}}`;
                }
                return `\\textbf{${content}}`;
            })
            .join(" & ") + " \\\\ \\hline\n";
    }

    processMulticolumn(content, props) {
        return `\\multicolumn{${props.multicolumn}}{c|}{${content}}`;
    }

    processMultirow(content, props) {
        return `\\multirow{${props.multirow}}{*}{${content}}`;
    }

    processMultirowAndMulticolumn(content, props) {
        return `\\multirow{${props.multirow}}{*}{\\multicolumn{${props.multicolumn}}{c|}{${content}}}}`;
    }

    processCell(cell) {
        const { content, props } = cell;
        if (props) {
            if (props.multirow && props.multicolumn) {
                return this.processMultirowAndMulticolumn(content, props);
            }
            if (props.multicolumn && props.multicolumn > 1) {
                return this.processMulticolumn(content, props);
            }
            if (props.multirow && props.multirow > 1) {
                return this.processMultirow(content, props);
            }
        }
        return content || "";
    }

    renderRows() {
        return this.rows
            .map(row => row.map(cell => this.processCell(cell)).filter(Boolean).join(" & ") + " \\\\ \\hline\n")
            .join("");
    }

    renderCaption() {
        return this.caption ? `\\caption{${this.caption}}\n` : "";
    }

    render() {
        return `\\begin{table}[H]\n` +
            `\\centering\n` +
            `\\begin{tabularx}{\\textwidth}{${this.generateColumnFormat()}}\n` +
            `\\hline\n` +
            this.renderTitle() +
            this.renderHeaders() +
            this.renderRows() +
            `\\end{tabularx}\n` +
            this.renderCaption() +
            `\\end{table}\n`;
    }
}

export default LatexTabularx

//ejemplo de uso
if (import.meta.url === `file://${process.argv[1]}`){
    
    const content = {
        headers: [
            { content: "Materia", props: { multicolumn: false, multirow: false } },
            { content: "Docente", props: { multicolumn: false, multirow: false } },
            { content: "Nota 1", props: { multicolumn: false, multirow: false } },
            { content: "Nota 2", props: { multicolumn: false, multirow: false } },
            { content: "Resultado", props: { multicolumn: false, multirow: false } }
        ],
        rows: [
            [
                { content: "Álgebra Lineal", props: { multicolumn: false, multirow: false } },
                { content: "José Luis Carvajal", props: { multicolumn: false, multirow: false } },
                { content: "14", props: { multicolumn: 2, multirow: false } },
                {},
                { content: "37", props: { multicolumn: false, multirow: false } }
            ],
            [
                { content: "Matemática Básica", props: { multicolumn: false, multirow: false } },
                { content: "Ángel Anchundia", props: { multicolumn: false, multirow: false } },
                { content: "26", props: { multicolumn: false, multirow: false } },
                { content: "1", props: { multicolumn: false, multirow: false } },
                { content: "27", props: { multicolumn: false, multirow: false } }
            ],
            [
                { content: "Algoritmos y Pseudocódigo", props: { multicolumn: false, multirow: false } },
                { content: "Adrián Vargas", props: { multicolumn: false, multirow: false } },
                {content: "Adrián Vargas", props: { multicolumn: false, multirow: false } },
                { content: "21", props: { multicolumn: false, multirow: false } },
                { content: "49", props: { multicolumn: false, multirow: false } }
            ],
            [
                { content: "Comunicación Oral", props: { multicolumn: false, multirow: false } },
                { content: "Jairon Caballero", props: { multicolumn: false, multirow: false } },
                { content: "0", props: { multicolumn: false, multirow: false } },
                { content: "0", props: { multicolumn: false, multirow: false } },
                { content: "0", props: { multicolumn: false, multirow: false } }
            ],
            [
                { content: "Tecnologías de la Información", props: { multicolumn: false, multirow: false } },
                { content: "Manuel Nevárez", props: { multicolumn: false, multirow: false } },
                { content: "10", props: { multicolumn: false, multirow: false } },
                { content: "0", props: { multicolumn: false, multirow: false } },
                { content: "10", props: { multicolumn: false, multirow: false } }
            ]
        ],
        title: "Reporte de Calificaciones",
        caption: "Tabla que muestra las calificaciones de los estudiantes en diversas materias"
    };

    const table = new LatexTabularx(content);

}