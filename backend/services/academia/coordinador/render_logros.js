import csvtojson from 'csvtojson';
import { getllamaSurvey } from '../../../utils/llama.js';
const csvobj = {};

export const renderLogros = (file) => {
    return new Promise((resolve, reject) => {
      csvtojson({ delimiter: ";" })
        .fromFile(file)
        .subscribe((jsonLine, index) => {
          csvobj[index] = jsonLine;
        })
        .then(async () => {
          try {
            let nrcs = Object.values(csvobj).map(linea => linea.NRC);
            let levels = Object.values(csvobj).map(linea => linea.NIVEL);
            nrcs = [...new Set(nrcs)];
            levels = [...new Set(levels)];
            const notas = {};
            const info_nrc = {};
            nrcs.forEach(nrc => {
              notas[nrc] = [];
              info_nrc[nrc] = {};
            });
  
            nrcs.forEach(nrc => {
              for (let key in csvobj) {
                if (nrc == csvobj[key].NRC) {
                  info_nrc[nrc].Asignatura = csvobj[key].titulo_curso;
                  delete csvobj[key].titulo_curso;
                  info_nrc[nrc].Docente = csvobj[key].nombres_completos_docente;
                  delete csvobj[key].nombres_completos_docente;
                  info_nrc[nrc].Semestre = csvobj[key].NIVEL;
                  delete csvobj[key].NIVEL;
                  info_nrc[nrc].nrc = csvobj[key].NRC;
                  notas[nrc].push(csvobj[key]);
                  delete csvobj[key];
                }
              }
            });
  
            for (let nrc in notas) {
              info_nrc[nrc]["Aprobados"] = 0;
              info_nrc[nrc]["Calificación_promedio"] = 0;
              info_nrc[nrc]["Porcentaje_supera_promedio"] = 0;
              info_nrc[nrc].Total_estudiantes = notas[nrc].length;
  
              notas[nrc].forEach(reg => {
                info_nrc[nrc]["Calificación_promedio"] += Number(reg.nota_final);
                if (reg.estado === "APROBADO") {
                  info_nrc[nrc]["Aprobados"]++;
                }
              });
              info_nrc[nrc]["Calificación_promedio"] = Number((info_nrc[nrc]["Calificación_promedio"] / info_nrc[nrc].Total_estudiantes).toFixed(2));
  
              notas[nrc].forEach(reg => {
                if (Number(reg.nota_final) > info_nrc[nrc].Calificación_promedio) {
                  info_nrc[nrc]["Porcentaje_supera_promedio"]++;
                }
              });
              info_nrc[nrc].Porcentaje_supera_promedio = `${(100 * (info_nrc[nrc]["Porcentaje_supera_promedio"] / info_nrc[nrc].Total_estudiantes)).toFixed(2)}`;
            }
  
            const info_level = {};
            levels.forEach(level => {
              info_level[level] = [];
            });
  
            for (let nrc in info_nrc) {
              for (let level in levels) {
                if (Number(info_nrc[nrc].Semestre) == Number(levels[level])) {
                  info_level[levels[level]].push(info_nrc[nrc]);
                  break;
                }
              }
            }
  
            const logros_survey={};

            for (const clave in info_level) {
                const llama_table=create_llamaTable(info_level[clave], clave)
                console.log(llama_table)
                const llama=await getllamaSurvey(llama_table)
                logros_survey[clave]=llama
            }
            // Resuelve la promesa con el objeto info_level
            resolve({table_logros:info_level,logros_survey});
          } catch (error) {
            // Rechaza la promesa si hay algún error
            reject(error);
          }
        })
        .catch(error => {
          // Rechaza la promesa si hay un error en la conversión del CSV
          reject(error);
        });
    });
  };
  



const create_llamaTable = (promedios, nivel) => { //Recibe un objeto con los Json de las calificaciones

    let llamaTable = `|Nivel: ${nivel}|`; 
    llamaTable += `|Materia|Docente|Número de Estudiantes|Número de Aprobados|Promedio del Curso|Porcentaje que supera el promedio|`;
    
    promedios.forEach(item => {
      llamaTable += `|${item.Asignatura} |${item.Docente} | ${item.Total_estudiantes} | ${item.Aprobados} | ${item.Calificación_promedio} | ${item.Porcentaje_supera_promedio}|`;
    });
  
  
    return llamaTable;
  
  }