import { create_latexEra } from '../../utils/latex.js';


export const dailc_va=(tables, surveys)=>{
    let latexfile="";
        for (const clave in tables) {
          console.log(`La clave es ${clave}`)
          latexfile= latexfile+create_latexTable(tables[clave], clave)
          let analisis=`\n\\vspace{1cm}\n\\section{Análisis de Rendimiento}\n${surveys[clave]}\\\\\n\\vspace{1cm}`
          analisis=analisis.replace(/%/g,"\\%")
          analisis=analisis.replace(/#/g,"\\#")
          analisis=analisis.replace(/_/g,"\\_")
          latexfile=latexfile+analisis+'\\\\'
        }
        return latexfile+=create_latexEra()
}

const create_latexTable = (promedios, nivel) => { //Recibe un objeto con los Json de las calificaciones

    let latexTable = `\\small\n\\begin{tabularx}{\\textwidth}{|p{2.5cm}|p{2.5cm}|X|X|X|X|}\n\\hline\n`;
    latexTable += `\\multicolumn{6}{|X|}{\\textbf{Nivel: ${nivel} }}\\\\\\hline`
    latexTable += `\\textbf{Materia} & \\textbf{Docente} & \\textbf{Estudiantes} & \\textbf{Aprobados} & \\textbf{Promedio} & \\textbf{\\%Supera el Promedio} \\\\ \\hline\n`;
  
    promedios.forEach(item => {
      latexTable += `${item.Asignatura} & ${item.Docente} & ${item.Total_estudiantes} & ${item.Aprobados} & ${item.Calificación_promedio} & ${item.Porcentaje_supera_promedio} \\%\\\\ \\hline\n`;
    });
  
    latexTable += `\\end{tabularx}\n`;
  
    return latexTable;
  
  }