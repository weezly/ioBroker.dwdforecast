
const axios = require('axios'),
    unzipper = require('unzipper'),
    sax = require('sax');

var LineTransform = require('node-line-reader').LineTransform;  // LineTransform constructor
var LineFilter = require('node-line-reader').LineFilter;  // LineFilter constructor

var transform = new LineTransform();

const dummyAdapter = { log: { debug: (...args) => { console.log(...args); }, error: (...args) => { console.error(...args); } } };

const readStationCatalog=({ adapter})=>{
    if(!adapter)
        adapter = dummyAdapter
    URL ="https://www.dwd.de/DE/leistungen/met_verfahren_mosmix/mosmix_stationskatalog.cfg?view=nasPublication&nn=16102"
    adapter.log.debug('Downloading station catalog');
    const stations=[]
    const transform = new LineTransform();
    // Skip empty lines and lines with "et" (with leading and trailing space) in them
    transform.on('data', function (line) {
        if (line.length == 0 || line.indexOf("TABLE") == 0 || line.indexOf("clu") == 0 || line.indexOf("=") == 0)
            return;
        const station={
            clu:line.substr(0, 5).trim(),
            CofX: line.substr(5, 5).trim(),
            id: line.substr(12, 5).trim(),
            ICAO: line.substr(18, 4).trim(),
            name: line.substr(23, 20).trim(),
            nb: Number.parseFloat(line.substr(44, 6)),
            el: Number.parseFloat(line.substr(52, 6)),
            elev: Number.parseInt(line.substr(59, 5)),
            hmodH: Number.parseInt(line.substr(65, 6)),
            type: line.substr(72, 4)
        }
        stations.push(station)
    });
    return new Promise((resolve, reject) => {
        // @ts-ignore
        axios({
            method: 'get',
            url: URL,
            responseType: 'stream'
        }).then((response) => {
            adapter.log.debug('Parsing stations');
            response.data.pipe(transform)
                .on('error', reject)
                .on('end', () => {
                    resolve(stations);
                });
        }).catch((error) => {
            if (error.response && error.response.status == 404) {
                reject(new Error('dwdweather.warn.noDataForStation'));
            } else {
                reject(error);
            }
        });
    });
}
const readElementDefinition=({ adapter=null})=>{
    if(!adapter)
        adapter = dummyAdapter;
    const URL ='https://opendata.dwd.de/weather/lib/MetElementDefinition.xml';
    adapter.log.debug('Downloading MetElementDefinition');

    const definition = {
    };


    const xmlTagStack = [];
    const xmlStreamParser = sax.createStream(true, {
        'trim': true
    });

    xmlStreamParser.onopentag = (tag) => {
        if (!tag.isSelfClosing) {
            xmlTagStack.push(tag);
        }
    };
    xmlStreamParser.onclosetag = (_tag) => {
        xmlTagStack.pop();
    };

    let currentShortName;
    xmlStreamParser.ontext = (text) => {
        if (xmlTagStack.length) {
            const currentTag = xmlTagStack[xmlTagStack.length - 1];
            if (xmlTagStack.length >= 2) {
                const enclosingTag = xmlTagStack[xmlTagStack.length - 2];
                if (enclosingTag.name == 'MetElement'){
                    if (currentTag.name=='ShortName'){
                        currentShortName=text;
                        definition[text]={};
                    } else if (currentShortName){
                        definition[currentShortName][currentTag.name]=text;
                    }
                }
            }
        }
    };
    return new Promise((resolve, reject) => {
        // @ts-ignore
        axios({
            method: 'get',
            url: URL,
            responseType: 'stream'
        }).then((response) => {
            adapter.log.debug('Parsing station data');
            response.data.pipe(xmlStreamParser)
                .on('error', reject)
                .on('end', () => {
                    resolve(definition);
                });
        }).catch((error) => {
            if (error.response && error.response.status == 404) {
                reject(new Error('dwdweather.warn.noDataForStation'));
            } else {
                reject(error);
            }
        });
    });
};
const readStationForecast = ({ stationId, adapter = null})=>{
    if (!adapter)
        adapter = dummyAdapter;
    const MOSMIX_URL = `https://opendata.dwd.de/weather/local_forecasts/mos/MOSMIX_L/single_stations/${stationId}/kml/MOSMIX_L_LATEST_${stationId}.kmz`;
    adapter.log.debug('Downloading station data');

    const weatherForecast = {
        stationId: stationId,
        times: [],
        forecast:{}
    };


    const xmlTagStack = [];
    const xmlStreamParser = sax.createStream(true, {
        'trim': true
    });

    xmlStreamParser.onopentag = (tag) => {
        if (!tag.isSelfClosing) {
            xmlTagStack.push(tag);
        }
    };
    xmlStreamParser.onclosetag = (_tag) => {
        xmlTagStack.pop();
    };
    xmlStreamParser.ontext = (text) => {
        if (xmlTagStack.length) {
            const currentTag = xmlTagStack[xmlTagStack.length - 1];
            if (xmlTagStack.length >= 2) {
                const enclosingTag = xmlTagStack[xmlTagStack.length - 2];
                switch(enclosingTag.name){
                    case 'dwd:ForecastTimeSteps':
                        if (currentTag.name == 'dwd:TimeStep')
                            // @ts-ignore
                            weatherForecast.times.push(new Date(text));
                        break;
                    case 'kml:Point':
                        if (currentTag.name == 'kml:coordinates') {
                            const coords = text.split(',');
                            weatherForecast.coordinates = {
                                longitude: coords[0],
                                latitude: coords[1],
                                height: coords[2]
                            };
                        }
                        break;
                    case 'dwd:ProductDefinition':
                    case 'dwd:Placemark':
                        {
                            const name = currentTag.name.split(':')[1];
                            weatherForecast.placemark = weatherForecast.placemark || {};
                            weatherForecast.placemark[name]=text;
                        }
                        break;

                    case 'dwd:Forecast':
                        if (currentTag.name == 'dwd:value'){
                            const name = enclosingTag.attributes['dwd:elementName'];
                            weatherForecast.forecast[name] = text.split(/\s+/).map(v => {
                                Number.parseFloat(v);
                            });
                        }
                        break;
                }
                if (enclosingTag.name == 'dwd:Forecast' && enclosingTag.attributes['dwd:elementName']) {
                    weatherForecast.forecast[enclosingTag.attributes['dwd:elementName']] = text.split(/\s+/).map(v => {
                        return Number.parseFloat(v);
                    });
                }
            }
        }
    };
    return new Promise((resolve, reject) => {
        // @ts-ignore
        axios({
            method: 'get',
            url: MOSMIX_URL,
            responseType: 'stream'
        }).then((response) => {
            adapter.log.debug('Parsing station data');
            response.data.pipe(unzipper.ParseOne(/\.kml/i))
                .on('error', reject)
                .pipe(xmlStreamParser)
                .on('error', reject)
                .on('end', () => {
                    resolve(weatherForecast);
                });
        }).catch((error) => {
            if (error.response && error.response.status == 404) {
                reject(new Error('dwdweather.warn.noDataForStation'));
            } else {
                reject(error);
            }
        });
    });
};

module.exports={
    readStationForecast : readStationForecast,
    readStationCatalog: readStationCatalog,
    readElementDefinition: readElementDefinition
};
