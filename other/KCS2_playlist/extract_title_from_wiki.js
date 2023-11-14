function extractTableData() {
  const tables = document.querySelectorAll('table');

  const resultMap = new Map();

  tables.forEach(table => {
    const rows = table.querySelectorAll('tr');

    selectedColumn = undefined
    rows.forEach(row => {
        const headers = Array.from(row.querySelectorAll('th')).map(element => element.textContent.trim());
        const rowData = Array.from(row.querySelectorAll('td')).map(element => element.textContent.trim());
        const rowIds = Array.from(row.querySelectorAll('td')).map(element => element.id);
        if (headers[0] === "-"){
            const header = headers.concat(rowData)
            selectedColumn = header.indexOf("English")
            if (selectedColumn == -1){
                selectedColumn = header.indexOf("Source")
            }
        } else if (selectedColumn && rowIds[0]){
            resultMap[rowIds[0].toLowerCase()] = rowData[selectedColumn];
        }
    })
  });
  return resultMap;
}

function mapToCsv(map) {
    let csvString = '';
  
    for (const [key, value] of Object.entries(map)) {
      csvString += `${key},${value}\n`;
    };
  
    return csvString;
  }

  function downloadCsv(map, filename) {
    const csvString = mapToCsv(map);
    const blob = new Blob([csvString], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.download = filename;
    link.click();
  }

map = extractTableData()
downloadCsv(map, 'output.csv');

