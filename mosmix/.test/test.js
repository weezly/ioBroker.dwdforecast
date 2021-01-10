const mosmix=require('../index');
const fs = require('fs');
const path = require('path');

mosmix.readStationCatalog({}).then(result => {
    fs.writeFileSync(path.join(__dirname, 'stations.json'), JSON.stringify(result, null, '\t'));
});
mosmix.readElementDefinition({}).then(result=>{
    fs.writeFileSync(path.join(__dirname, 'elementdefs.json'), JSON.stringify(result, null, '\t'));
});
mosmix.readStationForecast({stationId:'Q811'}).then(result=>{
    fs.writeFileSync(path.join(__dirname,'forecast.json'),JSON.stringify(result,null,'\t'));
    console.log('Success');
}).catch(err=>{
    console.log(err);
});

