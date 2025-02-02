class LatexComponet {
    constructor(content) {
        this.content = content || '';
    }

    render() {
        return '';
    }

    formatContent(content) {
        return content.replace(/\n{2,}/g, '\n')        
        .replace(/#/g, "\\#")
        .replace(/_/g, "\\_")
        .replace(/\$/g, "\\$")
        .replace(/\^/g, "\\^{}")
        .replace(/~/g, "\\textasciitilde{}")
        .replace(/\|/g, "\\textbar{}");;
    }
}

export default LatexComponet