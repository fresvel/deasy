import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const UTILS_DIR = path.dirname(fileURLToPath(import.meta.url));
const LEGACY_TEMPLATE_ROOT = path.resolve(UTILS_DIR, '..', 'templates_legacy');
const LEGACY_LATEX_SOURCE = path.join(LEGACY_TEMPLATE_ROOT, 'latex');
const LEGACY_RUNTIME_ROOT = path.join(LEGACY_TEMPLATE_ROOT, '_runtime');

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


const createlatexFiles = (dest) => {// Crear una copia de la plantilla para compilar los archivos latex
    return new Promise((resolve, reject) => {
      const runtimeDest = path.join(LEGACY_RUNTIME_ROOT, dest);
      if (!fs.existsSync(runtimeDest)) {
        fs.mkdirSync(runtimeDest, { recursive: true });
      } else {
        console.log(`La carpeta runtime/${dest} ya existe`);
      }
      try {
        fs.cpSync(LEGACY_LATEX_SOURCE, runtimeDest, { recursive: true });
        resolve(0);
      } catch (err) {
        reject(err);
      }
    });
  };


const saveLatexFile=(filePath, content)=> {
    return new Promise((resolve, reject) => {
        fs.writeFile(filePath, content, 'utf8', (err) => {
            if (err) {
              console.error('Error al guardar el archivo:', err);
              reject(err);
            }
            console.log('Archivo LaTeX guardado correctamente.');
            resolve(0);
          });
    });
  }


const latexTopdf = (source) => {
    return new Promise((resolve, reject) => {
  
        const command = 'pdflatex';
        const args = ['-output-directory=../../../public', `-jobname=${source}`,'main.tex'];
  
        // Ejecutar el comando `cp`
        const child = spawn(command, args, { cwd: path.join(LEGACY_RUNTIME_ROOT, source), shell: true });
  
        // Manejar salida estándar
        child.stdout.on('data', (data) => {
            //console.log(`stdout: ${data}`);
        });
  
        // Manejar errores
        child.stderr.on('data', (data) => {
            console.error(`stderr: ${data}`);
        });
  
        // Manejar el cierre del proceso
        child.on('close', (code) => {
            if (code === 0) {
                // Resolver la promesa si el proceso terminó con éxito
                resolve(code);
            } else {
                // Rechazar la promesa si el proceso terminó con un código de error
                reject(new Error(`El proceso terminó con el código ${code}`));
            }
        });
  
        // Manejar errores del proceso hijo
        child.on('error', (err) => {
            reject(err);
        });
    });
  };


export const compileLatexjs = async (file) => {
  try {
    let ret = await createlatexFiles(file.name);
    if (ret !== 0) throw new Error(`Error al crear archivos LaTeX: ${ret}`);
    
    const filePath = path.join(LEGACY_RUNTIME_ROOT, file.name, 'Contenido', 'Content.tex');
    ret = await saveLatexFile(filePath, file.content);
    if (ret !== 0) throw new Error(`Error al guardar el archivo LaTeX: ${ret}`);
    
    ret = await latexTopdf(file.name);
    if (ret !== 0) throw new Error(`Error al convertir LaTeX a PDF: ${ret}`);
    
    return ret; // La función `async` devolverá automáticamente una promesa que resuelve `ret`
  } catch (error) {
    throw error; // Lanzar el error para que pueda ser capturado donde se llama a `compileLatexjs`
  }
};
