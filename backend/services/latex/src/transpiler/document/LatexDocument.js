import { Section,Subsection, LatexText, Subsubsection, LatexParagraph } from "./elements/LatexSections.js";
import LatexFigure from "./elements/LatexFigure.js";
import LatexTabularx from "./elements/LatexTabularx.js";

class LatexDocument {
    constructor(data_blocks) {
        this.data_blocks = data_blocks.map(item => this.createElement(item));
    }

    createElement(item) {
        switch (item.type) {
            case 'section':
                return new Section(item.title, item.content);
            case 'subsection':
                return new Subsection(item.title, item.content);
            case 'subsubsection':
                return new Subsubsection(item.title, item.content);
            case 'text':
                return new LatexText(item.content);
            case 'table':
                return new LatexTabularx(item.content);
            case 'figure':
                return new LatexFigure(item.path, item.caption);
            case 'paragraph':
                return new LatexParagraph(item.title, item.content);
            default:
                return null;
        }
    }

    render() {
        let latex = '';
        this.data_blocks.forEach(item => {
            if (item) {
                latex += item.render();
            }
        });
        return latex;
    }
}

export default LatexDocument
