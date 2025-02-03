import fs from 'fs';
import { exec } from 'child_process';
import * as pdfjsLib from 'pdfjs-dist';


class SignCoordinates {
    constructor(file_path) {
        this.file_path = file_path;
        const index = file_path.lastIndexOf('/inicial');
        this.inicial_path = file_path.substring(0, index + '/inicial'.length);
        //this.elaborado_path=path.join(path.dirname(this.inicial_path),"elaborado");
        //this.aprobado_path=path.join(path.dirname(this.inicial_path),"aprobado");
        this.sign_script = "SignPdf.py"; //Reemplazar por exec
        this.sign_ids = { made: "!-era-ela-!", rev: "!-era-rev-!", apr: "!-era-apr-!" };
        this.era_coord = {};
        this.y_ofset=800
    }

    async getSignCoordinates() {
        const pdfData = new Uint8Array(fs.readFileSync(this.file_path));
        const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;

        for (let pageIndex = pdf.numPages; pageIndex > 0; pageIndex--) {
            const page = await pdf.getPage(pageIndex);
            const content = await page.getTextContent();

            for (const item of content.items) {
                this.checkSignCoordinates(item, pageIndex);
            }

            if (this.areAllCoordinatesFound()) {
                return this.era_coord;
            }
        }
    }

    checkSignCoordinates(item, page) {
        if (item.str.includes(this.sign_ids.made)) {
            const [a, b, c, d, x, y] = item.transform;
            this.era_coord.made = { x:Math.round(x), y:Math.round(y), page };
        }
        if (item.str.includes(this.sign_ids.rev)) {
            const [a, b, c, d, x, y] = item.transform;
            this.era_coord.rev = { x:Math.round(x), y:Math.round(y), page };
        }
        if (item.str.includes(this.sign_ids.apr)) {
            const [a, b, c, d, x, y] = item.transform;
            this.era_coord.apr = { x:Math.round(x), y:Math.round(y), page };
        }
    }

    areAllCoordinatesFound() {
        return this.era_coord.made && this.era_coord.rev && this.era_coord.apr;
    }

    addSignCoordinates(){//Cuidado con el path de entrada. Debe venir desde el sistema no enviar al usuario Posibilidad crear sistemas de rutas en base a hashes
        const command = `pyhanko sign addfields \\
        --field ${this.era_coord.made.page}/${this.era_coord.made.x},${this.era_coord.made.y},${this.era_coord.made.x+90},${this.era_coord.made.y-50}/ela \\
        --field ${this.era_coord.rev.page}/${this.era_coord.rev.x},${this.era_coord.rev.y},${this.era_coord.rev.x+90},${this.era_coord.rev.y-50}/rev \\
        --field ${this.era_coord.apr.page}/${this.era_coord.apr.x},${this.era_coord.apr.y},${this.era_coord.apr.x+90},${this.era_coord.apr.y-50}/apr \\
        ${this.file_path} ${this.inicial_path}/output.pdf`;

        console.log(command);
        exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error ejecutando el comando: ${error.message}`);
            return;
        }
        if (stderr) {
            console.error(`Error en el estándar de error: ${stderr}`);
            return;
        }
        console.log(`Salida: ${stdout}`);
        });


    }

}

const call_example=async  ()=>{
    const pdf_path="/home/fresvel/Documentos/Pucese/deasy/backend/services/signflow/informes/ITI/2024/SPO2024/Academia/inicial/input.pdf"
    const sign_pdf=new SignCoordinates(pdf_path)
    console.log(pdf_path.split("/").pop())
    await sign_pdf.getSignCoordinates()
    console.log(sign_pdf.era_coord)
    sign_pdf.addSignCoordinates()
}

call_example()