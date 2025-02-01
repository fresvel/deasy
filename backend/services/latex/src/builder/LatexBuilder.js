import fs from 'fs-extra';
import path from 'path';
import { exec } from 'child_process';

class LatexBuilder {
    constructor(template_name, project_name){
        this.project_name = project_name;
        this.class_dir = path.dirname(new URL(import.meta.url).pathname);
        this.src_dir = path.dirname(this.class_dir);
        this.script_name='compile.sh'
        this.sell_name = 'bash'  
        this.build_dir='build'     
        this.templates='templates'
        this.cloned_project = path.join(path.dirname(this.src_dir),this.build_dir, project_name);
        this.script_cloned = path.join(this.cloned_project, this.script_name);
        this.template = path.join(path.dirname(this.src_dir),this.templates,template_name);
        this.is_project_cloned = false;
        console.log("LatexBuilder done!!")
    }

    async compile(path_to_copy) {
        try {
            console.log("Compiling PDF")
            await this.verifyFileExists(this.script_cloned);
            
            const result=await new Promise((resolve, reject) => {
                const command = `${this.sell_name} ${this.script_cloned}`;
                exec(command, { cwd: this.cloned_project }, (error, stdout, stderr) => {
                    if (error) {
                        reject(`Error al ejecutar compile.sh: ${stderr}`);
                    } else {
                        resolve(stdout);
                    }
                });
            })
            const pdf_file=result.replace(/[\r\n]/g,'');
            const final_pdf=path.join(path_to_copy, this.project_name+'.pdf');
            await this.verifyFileExists(pdf_file);
            await fs.copy(pdf_file, final_pdf)
            await this.verifyFileExists(final_pdf)
            fs.rm(this.cloned_project,{ recursive: true, force: true }, (err)=>{
                if(err) console.log(`Error al eliminar directorio ${this.cloned_project}: ${err}`)
                else console.log(`Directorio ${this.cloned_project} eliminado correctamente`)
            })
            return final_pdf

        } catch (error) {
            throw new Error(`Compilación de archivo PDF falló: ${error}`);
        }
    }

    verifyFileExists(file_path) {
        return new Promise((resolve, reject) => {
            fs.pathExists(file_path, (err, exists) => {
                if (err) {
                    reject(`Error al verificar el archivo: ${err.message}`);
                } else if (!exists) {
                    reject(`No se encontró el archivo en la ruta: ${file_path}`);
                } else {
                    resolve();
                }
            });
        });
    }

    async cloneLatexProject() {
        console.log('Cloning project...');
        try {
        
            const script_builder=path.join(this.class_dir, this.script_name)
            await fs.copy(this.template, this.cloned_project);
            await fs.copy(script_builder, path.join(this.cloned_project,this.script_name));
            this.is_project_cloned=true;
            console.log(`Copia de plantilla latex completada`+this.cloned_project);


        } catch (err) {
            console.error(`Error al copiar el directorio de la plantilla latex: ${err.message}`);
        }
    }
}

export default LatexBuilder;

