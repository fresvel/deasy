import LatexElement from "../LatexElement.js";

class Section extends LatexElement {
    constructor(title, content) {
        super(content);
        this.title = title;
    }

    render() {
        return `\\section{${this.title}}\n${this.formatContent(this.content)}\n`;
    }
}

class Subsection extends LatexElement {
    constructor(title, content) {
        super(content);
        this.title = title;
    }

    render() {
        return `\\subsection{${this.title}}\n${this.formatContent(this.content)}\n`;
    }
}

class Subsubsection extends LatexElement {
    constructor(title, content) {
        super(content);
        this.title = title;
    }

    render() {
        return `\\subsubsection{${this.title}}\n${this.formatContent(this.content)}\n`;
    }
}

class Text extends LatexElement {
    constructor(content) {
        super(content);
    }

    render() {
        return this.formatContent(this.content)+'\n';
    }
}

export {Text, Section, Subsection, Subsubsection}