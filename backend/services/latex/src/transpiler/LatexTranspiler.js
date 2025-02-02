import { Section, Subsection, Text, Subsubsection } from "./document/LatexSections.js";
import LatexFigure from "./document/LatexFigure.js";
import LatexTabularx from "./document/LatexTabularx.js";


/*
class LatexTable {
    constructor(headers, rows, title = "", caption = "") {
        this.headers = headers;
        this.rows = rows;
        this.levelTitle = title;
        this.caption = caption;
    }

    generateColumnFormat() {
        return "|" + this.headers.map(() => "X").join("|") + "|";
    }

    renderLevelTitle() {
        if (this.levelTitle) {
            return `\\multicolumn{${this.headers.length}}{|c|}{\\textbf{${this.levelTitle}}}\\\\\\hline\n`;
        }
        return "";
    }

    renderHeaders() {
        return this.headers.map(header => `\\textbf{${header}}`).join(" & ") + " \\\\ \\hline\n";
    }

    renderRows() {
        return this.rows.map(row => row.join(" & ") + " \\\\ \\hline\n").join("");
    }

    renderCaption() {
        return this.caption ? `\\caption{${this.caption}}\n` : "";
    }

    render() {
        return `\\begin{table}[h]\n` +
            `\\centering\n` +
            `\\begin{tabularx}{\\textwidth}{${this.generateColumnFormat()}}\n` +
            `\\hline\n` +
            this.renderLevelTitle() +
            this.renderHeaders() +
            this.renderRows() +
            `\\end{tabularx}\n` +
            this.renderCaption() +
            `\\end{table}\n`;
    }
}
*/


class LatexTranspiler {
    constructor(jsonObj) {
        this.jsonObj = jsonObj.map(item => this.createElement(item));
    }

    createElement(item) {
        switch (item.type) {
            case 'section':
                return new Section(item.title, item.content);
            case 'subsection':
                return new Subsection(item.title, item.content);
            case 'subsubsection':
                return new Subsubsection(item.title, item.content);
            case 'text':
                return new Text(item.content);
            case 'table':
                return new LatexTabularx(item.content);
            case 'figure':
                return new LatexFigure(item.path, item.caption);
            default:
                return null;
        }
    }

    render() {
        let latex = '';
        this.jsonObj.forEach(item => {
            if (item) {
                latex += item.render();
            }
        });
        return latex;
    }
}

export default LatexTranspiler

/** 
// Ejemplo de uso
const jsonObj = [
    { "type": "section", "title": "Sección 1", "content": "Contenido de la sección 1" },
    { "type": "subsection", "title": "Subsección 1.1", "content": "Contenido de la subsección 1.1" },
    { "type": "subsubsection", "title": "Subsubsección 1.1.1", "content": "Contenido de la subsubsección 1.1.1" },
    { "type": "text", "content": "Este es un pálkjdjjhkajhdharrafo de texto que va después de la subsubsección." },
    { "type": "table", "headers": ["Header 1", "Header 2", "Header 3"],"title":"Titulo largo para escribir", "rows": [["A1", "B1", "C1"], ["A2", "B2", "C2"]], "caption": "Descripción de la tabla"},
    { "type": "figure", "path": "path/to/image.jpg", "caption": "Figura 1. Ejemplo de imagen" },
    { "type": "section", "title": "Sección 2", "content": "Contenido de la sección 2" },
    { "type": "section", "title": "Sección 2", "content": "Contenido de la sección 2" },
    { "type": "section", "title": "Sección 2", "content": "Contenido de la sección 2" }
];

const transpiler = new LatexTranspiler(jsonObj);
console.log(transpiler.render());
*/