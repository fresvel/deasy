import csvtojson from 'csvtojson'
import { create_latexEra, compileLatexjs } from '../../utils/latex.js';
const csvobj={}
const low_grades={}
const empty_grades={}

const reporte_estudiantes={}
const reporte_niveles={}

export const getlowGrades = (filepath, type="parcial_2") =>{
    return new Promise((resolve, reject) =>{
        csvtojson({delimiter:';'})
        .fromFile(filepath)
        .subscribe((jsonline, index)=>{
            csvobj[index]=jsonline;
        })
        .then(()=>{

            try {

                if (type==='parcial_1'){
                    for (let key in csvobj){
                        if (csvobj[key].nota_parcial_1<30){
                            if (csvobj[key].nota_parcial_1==='')
        
                                empty_grades[key]=csvobj[key];
                            else
                                low_grades[key]={
                                    id_estudiante:csvobj[key].id_banner_estudiante,
                                    materia:csvobj[key].titulo_curso,
                                    estudiante:csvobj[key].nombres_completos_estudiante,
                                    docente:csvobj[key].nombres_completos_docente,
                                    nivel:csvobj[key].NIVEL,
                                    nota1:csvobj[key].nota_parcial_1,
                                    nota2:'--',
                                    suma:csvobj[key].nota_parcial_1,
                                    nrc:csvobj[key].NRC
                                };
                        }
                    }
                }else if (type==='parcial_2'){
                    for (let key in csvobj){
                        if (Number(csvobj[key].nota_parcial_1)+Number(csvobj[key].nota_parcial_2)<60){
                            if (csvobj[key].nota_parcial_1===''||csvobj[key].nota_parcial_2==='')
        
                                empty_grades[key]=csvobj[key];
                            else
                                low_grades[key]={
                                    id_estudiante:csvobj[key].id_banner_estudiante,
                                    materia:csvobj[key].titulo_curso,
                                    estudiante:csvobj[key].nombres_completos_estudiante,
                                    docente:csvobj[key].nombres_completos_docente,
                                    nivel:csvobj[key].NIVEL,
                                    nota1:csvobj[key].nota_parcial_1,
                                    nota2:csvobj[key].nota_parcial_2,
                                    suma:Number(csvobj[key].nota_parcial_1)+Number(csvobj[key].nota_parcial_2),
                                    nrc:csvobj[key].NRC
                                };
                        }
                    }
                }else if (type==='final'){
                    for (let key in csvobj){
                        if (Number(csvobj[key].nota_final)>30||Number(csvobj[key].nota_exam_final)<20){
                            if (csvobj[key].nota_final===''||csvobj[key].nota_exam_final==='')
        
                                empty_grades[key]=csvobj[key];
                            else
                                low_grades[key]={
                                    id_estudiante:csvobj[key].id_banner_estudiante,
                                    materia:csvobj[key].titulo_curso,
                                    estudiante:csvobj[key].nombres_completos_estudiante,
                                    docente:csvobj[key].nombres_completos_docente,
                                    nivel:csvobj[key].NIVEL,
                                    nota1:csvobj[key].nota_final,
                                    nota2:csvobj[key].nota_exam_final,
                                    suma:"Reprobado",
                                    nrc:csvobj[key].NRC
                                };
                        }
                    }

                }
    
                let niveles= Object.values(low_grades).map(line => line.nivel);
                let nrcs= Object.values(low_grades).map(line => line.nrc);
                let estudiantes= Object.values(low_grades).map(line => line.id_estudiante)
                niveles=[... new Set(niveles)]
                nrcs=[... new Set(nrcs)];
                estudiantes=[... new Set(estudiantes)]; //
    
                /* Reporte por estudiantes */
                for (let estudiante of estudiantes){
                    reporte_estudiantes[estudiante] = {nombre:"",notas:[]}
                    for (let key in low_grades){
                        if (low_grades[key].id_estudiante===estudiante){
                            reporte_estudiantes[estudiante].nombre=low_grades[key].estudiante
                            break;
                        }
                    }
                }


                for (let estudiante of estudiantes) {
                    for (let key in low_grades) {
                        if (low_grades[key].id_estudiante==estudiante)
                            reporte_estudiantes[estudiante].notas.push(low_grades[key])
    
                }}


                for (let nivel of niveles) {
                    reporte_niveles[nivel]=[]
                    for (let estudiante in reporte_estudiantes) {
                        console.log(reporte_estudiantes[estudiante]);
                        for (let registro of reporte_estudiantes[estudiante].notas){
                            if (registro.nivel===nivel){
                                reporte_niveles[nivel].push(reporte_estudiantes[estudiante])
                                delete reporte_estudiantes[estudiante];
                                break;
                            }
                        }
                }}

                console.log(reporte_niveles)


                const url =renderLatexesreport(reporte_niveles)
                
    
                resolve(url);       
            } catch (error) {
                reject(error);
                
            }
            
        })
        .catch(error=>{
            reject(error);
        })
    })

}



const renderLatexesreport=async (objreport)=>{
    let latexfile="";
    for(let nivel in objreport){
        latexfile=latexfile+`\\section{Semestre: ${nivel}}
        Reporte de alertas de los estudiantes con bajo rendimiento en el semestre ${nivel} de la carrera de 
        Ingeniería en Tecnologías de la Información\\\\\\\\`
        for (let registro of objreport[nivel]){
          latexfile= latexfile+latexTableestudiantes(registro.notas, registro.nombre)
        }
    }

    try {
        await compileLatexjs({name:"tutoriasp01_2024_ii",content:latexfile}); // Invoca la función y espera a que se complete
        return `http://localhost:${process.env.PORT}/tutoriasp01_2024_ii.pdf`
        // Llama al siguiente middleware solo después de que compileLatexjs haya terminado
        //res.json(req.url);
    } catch (error) {
        console.error('Error en compileLatexjs:', error);
        return error; // Pasa el error al siguiente middleware de manejo de errores
    }
}


const latexTableestudiantes=(arraytable, title) => {
    let latexTable =`\\small\n\\begin{tabularx}{\\textwidth}{|p{5cm}|p{7cm}|X|X|X|}\n\\hline\n`;
    latexTable += `\\multicolumn{5}{|p{\\dimexpr\\textwidth-2\\tabcolsep-2\\arrayrulewidth}|}{\\textbf{Estudiante: ${title} }}\\\\\\hline\n`
    latexTable += `\\textbf{Materia} & \\textbf{Docente} & \\textbf{N1} & \\textbf{N2} & \\textbf{R} \\\\ \\hline\n`;
  
    arraytable.forEach(item => {
      latexTable += `${item.materia} & ${item.docente}  & ${item.nota1} & ${item.nota2}& ${item.suma} \\\\ \\hline\n`;
    });
  
    latexTable += `\\end{tabularx}\\vspace{10mm}\n`;

  
    return latexTable;

}
