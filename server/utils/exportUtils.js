const xlsx = require('xlsx');
const { Parser } = require('json2csv');

function selectPropertiesForObject(obj, properties) {
  return properties.reduce((result, property) => {
    if (property.condition && !property.condition(obj)) {
      return result;
    }

    const value = property.path.split('.').reduce((current, key) => current && current[key], obj);
    if (value !== undefined) {
      result[property.name] = value;
    }

    return result;
  }, {});
}

function generateExcel(data, sheetName) {
  const worksheet = xlsx.utils.json_to_sheet(data);
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, sheetName);

  return xlsx.write(workbook, { type: 'buffer' });
}

function generateCsv(data) {
  const json2csvParser = new Parser();
  return json2csvParser.parse(data);
}

module.exports = {
  generateExcel,
  generateCsv,
  selectPropertiesForObject,
};
