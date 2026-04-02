import fs from 'fs-extra';
import path from 'path';
import LatexBuilder from "../builder/LatexBuilder.js";
import LatexDocument from '../transpiler/document/LatexDocument.js';
import LatexHeader from '../transpiler/header/LatexHeader.js';

class LatexEditor extends LatexBuilder {
    constructor(report_json) {
        super(report_json.template, report_json.name);
        this.latex_modules = {
            header: {path:'Document/header.tex', controler:this.writeFileHeader.bind(this)},
            body: {path:'Document/body.tex', controler:this.writeFileBody.bind(this)},
            footer: {path:'Document/footer.tex', controler:this.writeFileFooter.bind(this)},
            preamble: {path:'Preamble/preamble.tex', controler:this.writeFilePreamble.bind(this)},
        };
        this.json_modules = report_json.modules
        console.log("LatexEditor done!!")
        //this.manageModules()        
    }


    async writeModules(){
        console.log('!!Writing Modules');

        if (!this.is_project_cloned){
            await this.cloneLatexProject();
        }
        
        for  (const module in this.json_modules){
            if (!this.latex_modules[module]) {
                throw new Error(`Módulo "${module}" no válido. Los módulos válidos son: ${Object.keys(this.latex_modules).join(", ")}`);
            }
            const content=await this.latex_modules[module].controler(this.json_modules[module])
            const latex_file = path.join(this.cloned_project, this.latex_modules[module].path);
            await fs.appendFile(latex_file, content);
            console.log(`Sección "${module}" actualizada correctamente. ${latex_file}`);
        }
    }

    async writeFileHeader(data_blocks){
        const header = new LatexHeader(data_blocks)
        return header.render()
    }

    async writeFileBody(data_blocks){
        const document = new LatexDocument(data_blocks);
        return document.render();
    }

    async writeFileFooter(){
        return ''
        
    }
    async writeFilePreamble(){
        return ''
    }

    async addResource(imagePath, imageName) {
        const destPath = path.join(this.cloned_project, 'resources', imageName);
        await fs.copy(imagePath, destPath);
        console.log(`Recurso "${imageName}" añadido.`);
    }

    async deleteResource(imageName) {
        const resourcePath = path.join(this.cloned_project, 'resources', imageName);
        await fs.remove(resourcePath);
        console.log(`Recurso "${imageName}" eliminado.`);
    }
}


export default LatexEditor;