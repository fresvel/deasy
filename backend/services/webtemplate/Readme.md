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



## 8. **NOTAS**

Para que funcione se requiere que al crear la plantilla se identifique las funciones que se llamó para construirla
entonces es importante que se cree un objeto que identifique la estructura de la tabla con las funciones creadas.(esto en el contorler para almacenar en la base de datos ... se debe seguir el flujo de procesos y ese flujo almacenarlo)

Por seguridad se identificará que estas funciones corresponden a funciones de esta clase, de lo contrario podría existir posible
vulnerabilidad de inyección de código.

Proceso:
1.- Obtener columnas y devolver al usuario
2.- Solicitar las columnas de trabajo (filtro)
3.- Cargar a la memoria los datos filtrados
4.- Devolver al usuario los datos agrupados por columnas (una  a la vez)


## **groupbyColumn('specific_column')**
The `groupByColumn` function adds a property to the groups object based on the value of a specific column. The resulting object contains data tables for each unique key found in the given column. The structure looks like this:

```javascript
template.groups {
  columnx_group: {
    'key01': { props: [Object], values: [Array] },
    'key02': { props: [Object], values: [Array] },
    ...
  },
  specific_column: {
    'key01': { props: [Object], values: [Array] },
    'key02': { props: [Object], values: [Array] },
    ...
  },
  ...
  }
```
Each group is an object representing a list of tables where the key is a common element found in the specified column. Later, each key can be converted into a LaTeX table. The props element contains the common properties for all records associated with a particular key, which has the same value, while the values array stores the individual records for the columns with different values.

The structure of a specific column object looks like this:

```javascript
template.groups['specific_column']['specific_key']= {
    props: {
      col01: 'common_value01',
      col02: 'common_value02',
      ...
    },
    values: [
      [Object], [Object],
      [Object], [Object],
      [Object], [Object],
      [Object]
    ]
  },

template.groups['specific_column']['specific_key'].values=[
    {
    col01: 'col01_val01',
    col02: 'col02_val01',
    ...
    },
    {
    col01: 'col01_val01',
    col02: 'col02_val02',
    ...
    },
    ...
  ]
```
### Description of `template.groups['specific_column']['specific_key']` Structure

The object `template.groups['specific_column']['specific_key']` represents a group of records within a specific column (`specific_column`) and a specific key (`specific_key`). This structure contains two main parts: `props` and `values`.

#### **props:**
- The `props` object contains the common values shared by all records under the specific key.
- For example, `col01` and `col02` are columns that hold common values (like `'common_value01'` and `'common_value02'`) for all records associated with `specific_key`.
- These values remain consistent for all entries in the `values` array below.

#### **values:**
- The `values` array holds individual records for each row associated with the key.
- Each record is an object containing values for each column (e.g., `col01`, `col02`, etc.).
- For example, the first record might have values like `'col01_val01'` and `'col02_val01'`, while the second record could contain different values such as `'col01_val01'` and `'col02_val02'`.

