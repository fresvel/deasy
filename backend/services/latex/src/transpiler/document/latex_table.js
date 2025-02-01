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



const tableData = {
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

const tableData2 = {
    headers: [
        { content: "Categoría", props: {} },
        { content: "Subcategoría", props: {} },
        { content: "Formato", props: {} },
        { content: "Ejemplo", props: {} }
    ],
    rows: [
        [
            { content: "numeric literals", props: { multirow: 10 } },
            { content: "integers", props: { multirow: 5 } },
            { content: "in decimal", props: {} },
            { content: "\\verb|8743|" }
        ],
        [
            {},
            {},
            { content: "in octal", props: { multirow: 2 } },
            { content: "\\verb|0o7464|" }
        ],
        [
            {},
            {},
            {},
            { content: "\\verb|0O103|" }
        ],
        [
            {},
            {},
            { content: "in hexadecimal", props: { multirow: 2 } },
            { content: "\\verb|0x5A0FF|" }
        ],
        [
            {},
            {},
            {},
            { content: "\\verb|0xE0F2|" }
        ],
        [
            {},
            { content: "fractionals", props: { multirow: 5 } },
            { content: "in decimal", props: { multirow: 5 } },
            { content: "\\verb|140.58|" }
        ],
        [
            {},
            {},
            {},
            { content: "\\verb|8.04e7|" }
        ],
        [
            {},
            {},
            {},
            { content: "\\verb|0.347E+12|" }
        ],
        [
            {},
            {},
            {},
            { content: "\\verb|5.47E-12|" }
        ],
        [
            {},
            {},
            {},
            { content: "\\verb|47e22|" }
        ],
        [
            { content: "A", props: {} },
            { content: "\\multicolumn{2}{l|}{\\multirow{3}{*}{char literals}}", props: { multicolumn: 2, multirow: 3 } },
            { content: "\\verb|'H'|" }
        ],
        [
            { content: "B", props: {} },
            {},
            { content: "\\verb|'\\n'|" }
        ],
        [
            { content: "C", props: {} },
            {},
            { content: "\\verb|'\\x65'|" }
        ],
        [
            { content: "\\multicolumn{3}{|l|}{\\multirow{2}{*}{string literals}}", props: { multicolumn: 3, multirow: 2 } },
            { content: "\\verb|\"bom dia\"|" }
        ],
        [
            {},
            { content: "\\verb|\"ouro preto\\nmg\"|" }
        ]
    ],
    title: "Ejemplo de Tabla con Multirow y Multicolumn",
    caption: "Ejemplo generado de tabla en LaTeX con estructuras avanzadas"
};

const table = new LatexTable(tableData.headers, tableData.rows, tableData.title, tableData.caption);
console.log(table.render());


/**
 * Ejemplo completo de tabla latex
 * \begin{tabular}{|l|l|l|l|}\hline
        \multirow{10}{*}{numeric literals} & \multirow{5}{*}{integers} & in decimal & \verb|8743| \\ \cline{3-4}
        & & \multirow{2}{*}{in octal} & \verb|0o7464| \\ \cline{4-4}
        & & & \verb|0O103| \\ \cline{3-4}
        & & \multirow{2}{*}{in hexadecimal} & \verb|0x5A0FF| \\ \cline{4-4}
        & & & \verb|0xE0F2| \\ \cline{2-4}
        & \multirow{5}{*}{fractionals} & \multirow{5}{*}{in decimal} & \verb|140.58| \\ \cline{4-4}
        & & & \verb|8.04e7| \\ \cline{4-4}
        & & & \verb|0.347E+12| \\ \cline{4-4}
        & & & \verb|5.47E-12| \\ \cline{4-4}
        & & & \verb|47e22| \\ \cline{1-4}
        A&\multicolumn{2}{l|}{\multirow{3}{*}{char literals}} & \verb|'H'| \\ \cline{4-4}
        B&\multicolumn{2}{l|}{} & \verb|'\n'| \\ \cline{4-4}          %% here
        C&\multicolumn{2}{l|}{} & \verb|'\x65'| \\ \cline{1-4}        %% here
        \multicolumn{3}{|l|}{\multirow{2}{*}{string literals}} & \verb|"bom dia"| \\ \cline{4-4}
        \multicolumn{3}{|l|}{} & \verb|"ouro preto\nmg"| \\ \cline{1-4}          %% here
      \end{tabular}

Se pretente procesar así:
multicolumn
multirow
multicolumnrow -- Filas y columnas múltiples
 */