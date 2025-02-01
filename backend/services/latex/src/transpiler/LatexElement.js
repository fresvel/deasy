class LatexElement {
    constructor(content) {
        this.content = content || '';
    }

    render() {
        return '';
    }

    formatContent(content) {
        return content.replace(/\n{2,}/g, '\n')        
        //.replace(/\n/g, '\\newline\n')
        .replace(/%/g, "\\%")
        .replace(/#/g, "\\#")
        .replace(/_/g, "\\_")
        .replace(/\$/g, "\\$")
        .replace(/&/g, "\\&")
        .replace(/{/g, "\\{")
        .replace(/}/g, "\\}")
        .replace(/\^/g, "\\^{}")
        .replace(/~/g, "\\textasciitilde{}")
        //.replace(/\\/g, "\\textbackslash{}")
        .replace(/\|/g, "\\textbar{}");;
    }
}

export default LatexElement