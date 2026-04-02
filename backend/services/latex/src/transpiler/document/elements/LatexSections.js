import LatexComponet from "../../LatexComponet.js";


class LatexText extends LatexComponet {
    constructor(content) {
        super();
        this.content = content;
    }

    formatContent(content) {
        //content=content.replace(/\\/g, "\\textbackslash")
        return super.formatContent(content)
        .replace(/{/g, "\\{")
        .replace(/}/g, "\\}")
        .replace(/&/g, "\\&")
        .replace(/%/g, "\\%")
    }

    render() {
        return this.formatContent(this.content)+'\n';
    }
}


class Section extends LatexText {
    constructor(title, content) {
        super(content);
        this.title = title;
        this.content=content;
    }

    render() {
        return `\\section{${this.formatContent(this.title)}}\n${this.formatContent(this.content)}\n`;
    }
}

class Subsection extends LatexText {
    constructor(title, content) {
        super(content);
        this.title = title;
        this.content=content;
    }

    render() {
        return `\\subsection{${this.title}}\n${this.formatContent(this.content)}\n`;
    }
}

class Subsubsection extends LatexText {
    constructor(title, content) {
        super(content);
        this.title = title;
        this.content=content;
    }

    render() {
        return `\\subsubsection{${this.title}}\n${this.formatContent(this.content)}\n`;
    }


}




class LatexParagraph extends LatexText {
    constructor(title, content) {
        super(content);
        this.title = title;
        this.content=content;
    }
    render() {
        return `\\textbf{${this.title}}\n\n${this.formatContent(this.content)}\n`;
    }


}

export {LatexText, Section, Subsection, Subsubsection, LatexParagraph}