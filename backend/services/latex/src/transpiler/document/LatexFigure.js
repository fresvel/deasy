import LatexElement from "../LatexElement.js";

class LatexFigure extends LatexElement {
    constructor(path, caption) {
        super();
        this.path = path;
        this.caption = caption;
    }

    render() {
        return `\\begin{figure}[h!]\n\\centering\n\\includegraphics[width=0.8\\textwidth]{${this.path}}\n\\caption{${this.caption}}\n\\end{figure}\n`;
    }
}

export default LatexFigure;