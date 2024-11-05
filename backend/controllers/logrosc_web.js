import { renderLogros } from "../helpers/render_logros.js";

export const logroscWeb= async(req, res)=>{

  console.log(req.uid)
  
  if (!req.file) {
    return res.status(400).json({error: 'No file uploaded.'});
  }
  try {
    const json_logros=await renderLogros(req.file.path)
    console.log("JSON***************************************************")
    console.log(json_logros)
    res.json(json_logros)
  } catch (error) {
    return res.status(400).json({
      message: 'Error al subir el archivo',
      error: error.message
    });
  }
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


const saveLatexFile=(filePath, content)=> {
  fs.writeFile(filePath, content, 'utf8', (err) => {
    if (err) {
      console.error('Error al guardar el archivo:', err);
      return;
    }
    console.log('Archivo LaTeX guardado correctamente.');
  });
}





