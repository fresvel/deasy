import LatexComponet from "../../LatexComponet.js";

class LatexTabularx extends LatexComponet  {
    constructor(content) {
        super();
        this.headers = content.headers;
        this.rows = content.rows;
        this.title = content.title;
        this.caption = content.caption;
    }

    generateColumnFormat() {
        return "|" + this.headers.map(() => "X").join("|") + "|";
    }

    renderTitle() {
        return this.title
            ? `\\multicolumn{${this.headers.length}}{|c|}{\\textbf{${this.title}}}\\\\\\hline\n`
            : "";
    }

    renderHeaders() {
        return this.headers
            .map(({ content, props }) => {
                if (props?.multicolumn && props.multicolumn > 1) {
                    return `\\multicolumn{${props.multicolumn}}{|c|}{\\textbf{${content}}}`;
                }
                return `\\textbf{${content}}`;
            })
            .join(" & ") + " \\\\ \\hline\n";
    }

    processMulticolumn(content, props) {
        return `\\multicolumn{${props.multicolumn}}{c|}{${content}}`;
    }

    processMultirow(content, props) {
        return `\\multirow{${props.multirow}}{*}{${content}}`;
    }

    processMultirowAndMulticolumn(content, props) {
        return `\\multirow{${props.multirow}}{*}{\\multicolumn{${props.multicolumn}}{c|}{${content}}}}`;
    }

    processCell(cell) {
        const { content, props } = cell;
        if (props) {
            if (props.multirow && props.multicolumn) {
                return this.processMultirowAndMulticolumn(content, props);
            }
            if (props.multicolumn && props.multicolumn > 1) {
                return this.processMulticolumn(content, props);
            }
            if (props.multirow && props.multirow > 1) {
                return this.processMultirow(content, props);
            }
        }
        return content || "";
    }

    renderRows() {
        return this.rows
            .map(row => row.map(cell => this.processCell(cell)).filter(Boolean).join(" & ") + " \\\\ \\hline\n")
            .join("");
    }

    renderCaption() {
        return this.caption ? `\\caption{${this.caption}}\n` : "";
    }

    render() {
        return `\\begin{table}[h]\n` +
            `\\centering\n` +
            `\\begin{tabularx}{\\textwidth}{${this.generateColumnFormat()}}\n` +
            `\\hline\n` +
            this.renderTitle() +
            this.renderHeaders() +
            this.renderRows() +
            `\\end{tabularx}\n` +
            this.renderCaption() +
            `\\end{table}\n`;
    }
}

export default LatexTabularx