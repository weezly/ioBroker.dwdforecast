
const axios = require("axios"),
    unzipper = require("unzipper"),
    sax = require("sax");

const read=(adapter)=>{
    const MOSMIX_URL = `https://opendata.dwd.de/weather/local_forecasts/mos/MOSMIX_L/single_stations/${adapter.config.mosmixStationId}/kml/MOSMIX_L_LATEST_${adapter.config.mosmixStationId}.kmz`;
    adapter.log.debug("Reading MOSMIX data");

    var weatherForecast = {
        stationId: adapter.config.mosmixStationId,
        "description": "",
        "times": []
    }; // main data structure to hold weather forecast. See initWeatherForecast()


    const mosmixElementsBase = ['TTT', 'Td', 'FF', 'DD', 'wwP', 'RR1c'];
    let xmlTagStack = [];
    let xmlStreamParser = sax.createStream(true, {
        'trim': true
    });

    xmlStreamParser.onopentag = (tag) => {
        if (!tag.isSelfClosing) {
            xmlTagStack.push(tag);
        }
    };
    xmlStreamParser.onclosetag = (tag) => {
        xmlTagStack.pop();
    };
    xmlStreamParser.ontext = (text) => {
        if (xmlTagStack.length) {
            var currentTag = xmlTagStack[xmlTagStack.length - 1];
            if (currentTag.name == "kml:description") {
                weatherForecast.description = text;
            }
            if (currentTag.name == "dwd:TimeStep") {
                weatherForecast.times.push(new Date(text));
            }
            if (xmlTagStack.length >= 2 && currentTag.name == "dwd:value") {
                var enclosingTag = xmlTagStack[xmlTagStack.length - 2];
                if (enclosingTag.name == "dwd:Forecast" && enclosingTag.attributes["dwd:elementName"] && mosmixElementsBase.includes(enclosingTag.attributes["dwd:elementName"])) {
                    weatherForecast[enclosingTag.attributes["dwd:elementName"]] = text.split(/\s+/).map(v => Number.parseFloat(v));
                }
            }
        }
    };
    return new Promise((resolve, reject) => {
        axios({
            method: "get",
            url: MOSMIX_URL,
            responseType: "stream"
        }).then((response) => {
            adapter.log.debug("Got MOSMIX zip");
            response.data.pipe(unzipper.ParseOne(/\.kml/i))
                .on('error', reject)
                .pipe(xmlStreamParser)
                .on('error', reject)
                .on('end', () => {
                    resolve(weatherForecast)
                });
        }).catch((error) => {
            if (error.response && error.response.status == 404) {
                reject(new Error("dwdweather.warn.noDataForStation"));
            } else {
                reject(error)
            };
        });
    })
}

// const adapter={
//     log:{
//         error:(...args)=>{
//             console.error(...args)
//         },
//         debug: (...args) => {
//             console.log(...args)
//         }
//     },
//     config: {
//         mosmixStationId: "Q811"
//     }
// }

// read(adapter).then(result=>{
//     console.log(result)
// }).catch(err=>{
//     console.log(err)
// })

module.exports.read=read