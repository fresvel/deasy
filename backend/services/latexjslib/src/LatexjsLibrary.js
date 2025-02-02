

class LatexjsLibrary {
    constructor() {
    }

    create_latexEra(json_era) {
        const datestr = new Date().toISOString().substring(0, 10);
        return {
            headers: [
                { content: "ELABORADO POR:",props: { multicolumn: false, multirow: false } },
                { content: "REVISADO POR:", props: { multicolumn: false, multirow: false } },
                { content: "APROBADO POR:", props: { multicolumn: false, multirow: false } },
            ],
            rows: [
                [
                    { content: `Firma: \\newline \\newline \\newline \\newline`,props: { multicolumn: false, multirow: false } },
                    { content: "Firma:", props: { multicolumn: false, multirow: false } },
                    { content: "Firma:", props: { multicolumn: false, multirow: false } },
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
                    { content: `Fecha: ${datestr}`, props: { multicolumn: false, multirow: false } },
                    { content: `Fecha: ${datestr}`, props: { multicolumn: false, multirow: false } },
                    { content: `Fecha: ${datestr}`, props: { multicolumn: false, multirow: false } },
                ],
            ],
        }; 

    }
    

    
}

export const create_latexEra=() => { //recibe un objeto

    const latexEra=`\\begin{tabularx}{\\textwidth}{|X|X|X|}
    \\hline
    \\textbf{ELABORADO POR:} & \\textbf{REVISADO POR:} & \\textbf{APROBADO POR:} \\\\ \\hline
    Firma: & Firma: & Firma:\\\\
    &&\\\\
    &&\\\\
    &&\\\\ \\hline
    \\textbf{Nombre: Homero Velasteguí} & \\textbf{Nombre: Manuel Nevarez} & \\textbf{Nombre: Pablo Pico Valencia PhD.} \\\\ \\hline
    \\textbf{Cargo: Coordinador Carrera} & \\textbf{Cargo: Consejo de Escuela} & \\textbf{Cargo: Director Académico} \\\\ \\hline
    \\textbf{Fecha: 9/3/2024} & \\textbf{Fecha: 9/3/2024} & \\textbf{Fecha: 9/3/2024} \\\\ \\hline
    \\end{tabularx}\n`
    
    return latexEra
}