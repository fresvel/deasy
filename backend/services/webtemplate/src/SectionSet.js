class SectionSet {
    constructor(col_set, col_id, label, desc="") {
        
        this.sections = {};
        this.label = label||this.col_id;

        for (let set_id in col_set) {
            if (col_set[set_id].props?.hasOwnProperty(col_id)) {
                const section=col_set[set_id].props[col_id];
                if (!this.sections.hasOwnProperty(section)) {
                    this.sections[section] = {};
                }
                this.sections[section][set_id] = col_set[set_id];
           }
        }

        this.desc = desc;
        //return this.sections;
    }
}

export default SectionSet;