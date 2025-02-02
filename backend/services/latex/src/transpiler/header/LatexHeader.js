import LatexComponet from "../LatexComponet.js";

class LatexHeader {
    constructor(data_blocks) {
        this.data_blocks = data_blocks.map(item => this.createElement(item));
    }

    createElement(item) {
        switch (item.type) {
            case 'def':
                return new HeaderDef(item.element);
            case 'make':
                return new HeaderMaker(item.content);
            case 'command':
                return new Text(item.content);
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


class HeaderDef extends LatexComponet{
    constructor(def_element){
        super(def_element);
    }

    render() {
        return `${this.formatContent(this.content)}\n`;
    }
}

class HeaderMaker extends LatexComponet{
    constructor(content){
        super(content);
    }
    render() {
        return `${this.formatContent(this.content)}\n`;
    }
}

export default LatexHeader;