class MapFunctions{
    constructor(value_sets){
    }

    getAverage(row, params, register) {
        let suma = 0, count = 0;
        params.forEach(col_id => {
          const valor = parseFloat(row[col_id]);
          if (!isNaN(valor)) { 
            suma += valor;
            count++;
          }
        });
        return count ? (suma / count).toFixed(2) : null;
    }
}

export default MapFunctions