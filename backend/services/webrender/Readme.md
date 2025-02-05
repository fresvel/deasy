# `TemplateMaker` Class Documentation  

The `TemplateMaker` class allows the creation of report templates based on CSV data files. This tool facilitates data conversion, building LaTeX elements, and generating reports.

## Usage  

### 1. **Loading CSV Data**  
To begin, load the CSV files containing the data to be analyzed.

### 2. **Converting to JSON Format**  
The class converts the CSV data into JSON format. This enables:  
   - Filtering tables  
   - Setting properties  
   - Managing statistical operations  

### 3. **Data Preprocessing**  
The `TemplateMaker` class preprocesses the data and provides functionalities for:  
   - Building tables  
   - Generating figures  
   - Performing analysis  

### 4. **Report Structure**  
The primary goal of this class is to create a basic structure in JSON format for a template element of a report object, which will later be used by a `LatexEditor` instance to build a PDF report. The structure of the report should look as follows:

```javascript
const report = {
    "name": "report_name",
    "path": "path_to_save_report",
    "modules": modules_element,
    "template": template_element
};
```
The `template_element` object serves as the base upon which the report will be built. Initially, this object will be created by a privileged user who trains the system using the CSV data. Later, the template will be cleared. Afterwards, regular users can fill the template with additional information provided by a new CSV file.

### 5. **Structure of modules_element and template_element**
Both `modules_element` and `template_element` are arrays of objects, and their structure is as follows:

```javascript
element = {
    "type": "element_type",
    "payload": "element_payload"
}
```

- type: Specifies the type of LaTeX element being created (table, figure, section, etc.).
- payload: Contains the JSON data that defines the structure of the LaTeX element (for example, the content of a section or text).

Example of a section element and text element:

```javascript
section_element = {
    "type": "section",
    "payload": {"title": "section_title", "content": "section_content"}
}

text_element = {
    "type": "section",
    "payload": {"content": "text_content"}
}
```

### 6. **Generating Reports**

This class allows too converting the JSON tables obtained from the CSV file into figures and sending data to a large language model (LLM) instance for further processing. The goal is to generate a structured template that contains the essential report information.


## 7. **Saving and Sharing Templates**

The final template is a JSON object that represents the structure of the report. This object is stored in a database and can be shared with other users. Users can load new data into the template to generate a pre-built report.