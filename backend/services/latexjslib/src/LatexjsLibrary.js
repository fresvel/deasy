

class LatexjsLibrary {
    constructor() {
    }

    set_dates(days) {
        const date = new Date();
        date.setDate(date.getDate() + days);
        return date.toISOString().substring(0, 10);
    }

    create_latexEra(json_era) {
        return {
            headers: [
                { content: "ELABORADO POR:",props: { multicolumn: false, multirow: false } },
                { content: "REVISADO POR:", props: { multicolumn: false, multirow: false } },
                { content: "APROBADO POR:", props: { multicolumn: false, multirow: false } },
            ],
            rows: [
                [
                    { content: `Firma: \\textcolor{white}{\\$era-e\\$} \\newline \\newline \\newline \\newline`,props: { multicolumn: false, multirow: false } },
                    { content: "Firma: \\textcolor{white}{\\$era-r\\$} ", props: { multicolumn: false, multirow: false } },
                    { content: "Firma: \\textcolor{white}{\\$era-a\\$}", props: { multicolumn: false, multirow: false } },
                ],
                [
                    { content: `Nombre: ${json_era.made.name}`, props: { multicolumn: false, multirow: false } },
                    { content: `Nombre: ${json_era.reviewed.name}`, props: { multicolumn: false, multirow: false } },
                    { content: `Nombre: ${json_era.approved.name}`, props: { multicolumn: false, multirow: false } },
                ],
                [
                    { content: `Cargo: ${json_era.made.cargo}`, props: { multicolumn: false, multirow: false } },
                    { content: `Cargo: ${json_era.reviewed.cargo}`, props: { multicolumn: false, multirow: false } },
                    { content: `Cargo: ${json_era.approved.cargo}`, props: { multicolumn: false, multirow: false } },
                ],
                [
                    { content: `Fecha: ${this.set_dates(0)}`, props: { multicolumn: false, multirow: false } },
                    { content: `Fecha: ${this.set_dates(7)}`, props: { multicolumn: false, multirow: false } },
                    { content: `Fecha: ${this.set_dates(14)}`, props: { multicolumn: false, multirow: false } },
                ],
            ],
        }; 

    }

    create_base_header(json_header){
        return `
        \\def\\programa{${json_header.programa}}
        \\def\\periodo{${json_header.periodo}}
        \\def\\titulo{\\textbf{${json_header.titulo}}}
        
        \\begin{center}
        \\Large\\titulo\\\\     
        \\end{center}
        
        \\large
        \\begin{tabularx}{\\textwidth}{ p{20mm} p{8.7cm} p{4cm}}
        
        \\textbf{Carrera:} & \\programa & \\raggedleft\\textbf{Semestre:} \\periodo \\\\
        \\end{tabularx}\\vspace{10mm}
        \\renewcommand{\\arraystretch}{1.5}
        \\noindent
        `;
        }
        
    

    
}
export default LatexjsLibrary