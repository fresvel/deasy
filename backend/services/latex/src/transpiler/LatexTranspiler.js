class LatexElement {
    constructor(content) {
        this.content = content || '';
    }

    render() {
        return '';
    }

    formatContent(content) {
        return content.replace(/\n{2,}/g, '\n')        
        //.replace(/\n/g, '\\newline\n')
        .replace(/%/g, "\\%")
        .replace(/#/g, "\\#")
        .replace(/_/g, "\\_")
        .replace(/\$/g, "\\$")
        .replace(/&/g, "\\&")
        .replace(/{/g, "\\{")
        .replace(/}/g, "\\}")
        .replace(/\^/g, "\\^{}")
        .replace(/~/g, "\\textasciitilde{}")
        //.replace(/\\/g, "\\textbackslash{}")
        .replace(/\|/g, "\\textbar{}");;
    }
}

class Section extends LatexElement {
    constructor(title, content) {
        super(content);
        this.title = title;
    }

    render() {
        return `\\section{${this.title}}\n${this.formatContent(this.content)}\n`;
    }
}

class Subsection extends LatexElement {
    constructor(title, content) {
        super(content);
        this.title = title;
    }

    render() {
        return `\\subsection{${this.title}}\n${this.formatContent(this.content)}\n`;
    }
}

class Subsubsection extends LatexElement {
    constructor(title, content) {
        super(content);
        this.title = title;
    }

    render() {
        return `\\subsubsection{${this.title}}\n${this.formatContent(this.content)}\n`;
    }
}

class Text extends LatexElement {
    constructor(content) {
        super(content);
    }

    render() {
        return this.formatContent(this.content)+'\n';
    }
}

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

class Figure extends LatexElement {
    constructor(path, caption) {
        super();
        this.path = path;
        this.caption = caption;
    }

    render() {
        return `\\begin{figure}[h!]\n\\centering\n\\includegraphics[width=0.8\\textwidth]{${this.path}}\n\\caption{${this.caption}}\n\\end{figure}\n`;
    }
}

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
                return new LatexTable(item.headers, item.rows, item.title, item.caption);
            case 'figure':
                return new Figure(item.path, item.caption);
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