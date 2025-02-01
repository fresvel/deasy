import LatexTranspiler from "./transpiler/LatexTranspiler.js";
import LatexCompiler from "./compiler/LatexCompiler.js";
import path from "path";

class PdfLatexJS {
    constructor(latex_obj) {
        this.pdf_dest = latex_obj.path;
        this.filename = latex_obj.filename;
        this.class_dir = path.dirname(new URL(import.meta.url).pathname);
        this.pdf_compiled = ''
    }

    // Método principal para generar el PDF
    async publicPdfResult() {
        try {
            await this.createLatexProject();
            await this.compileLatex();
        } catch (err) {
            console.error('Error durante el proceso:', err);
        }
    }

    async createLatexProject() {
        try {
            const transpiler = new LatexTranspiler({latex_json: true});
            await transpiler.createOutputProject(this.filename);
            console.log("Proyecto creado con éxito.");
        } catch (err) {
            throw new Error("Error al crear el proyecto: " + err.message);
        }
    }

    async compileLatex() {
        try {
            const compiler = new LatexCompiler(this.filename);
            this.pdf_compiled = await compiler.compile();
            console.log('Compilación exitosa:', this.pdf_compiled);
        } catch (err) {
            throw new Error("Error en la compilación: " + err.message);
        }
    }

}


const base_dir = path.dirname(new URL(import.meta.url).pathname);

const latex_obj = {
    "filename": "informe_t",// el filename debe ser único
    "path": path.join(base_dir, "informes","elaborados"),
    "content": []
};

// Crear una instancia de PdfLatexJS y ejecutar el proceso
const pdflatex = new PdfLatexJS(latex_obj);
pdflatex.publicPdfResult();
