class LatexTable {
    constructor(headers, rows, title = "", caption = "") {
        this.headers = headers;
        this.rows = rows;
        this.title = title;
        this.caption = caption;
    }

    generateColumnFormat() {
        return "|" + this.headers.map(() => "X").join("|") + "|";
    }

    renderTitle() {
        if (this.title) {
            return `\\multicolumn{${this.headers.length}}{|c|}{\\textbf{${this.title}}}\\\\\\hline\n`;
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
            this.renderTitle() +
            this.renderHeaders() +
            this.renderRows() +
            `\\end{tabularx}\n` +
            this.renderCaption() +
            `\\end{table}\n`;
    }
}

// Ejemplo de uso de la clase LatexTable
const tableData = {
    headers: ["Materia", "Docente", "Nota 1", "Nota 2", "Resultado"],
    rows: [
        ["Álgebra Lineal", "José Luis Carvajal", "14", "23", "37"],
        ["Matemática Básica", "Ángel Anchundia", "26", "1", "27"],
        ["Algoritmos y Pseudocódigo", "Adrián Vargas", "28", "21", "49"],
        ["Comunicación Oral", "Jairon Caballero", "0", "0", "0"],
        ["Tecnologías de la Información", "Manuel Nevárez", "10", "0", "10"]
    ],
    title: "Reporte de Calificaciones",
    caption: "Tabla que muestra las calificaciones de los estudiantes en diversas materias"
};

// Creación de una instancia de la clase LatexTable
const table = new LatexTable(
    tableData.headers,    // Encabezados de la tabla
    tableData.rows,       // Filas de la tabla
    tableData.title,      // Título (opcional)
    tableData.caption     // Leyenda (opcional)
);

// Generar el código LaTeX de la tabla
const latexCode = table.render();

// Mostrar el código LaTeX generado en la consola
console.log(latexCode);
