// @ts-nocheck
'use strict';

/*
 * Created with @iobroker/create-adapter v1.31.0
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require('@iobroker/adapter-core');
const mosmix = require('./mosmix');

// Load your modules here, e.g.:
// const fs = require("fs");

class Template extends utils.Adapter {

    /**
     * @param {Partial<utils.AdapterOptions>} [options={}]
     */
    constructor(options) {
        super({
            ...options,
            name: 'dwdforecast',
        });
        this.on('ready', this.onReady.bind(this));
        // this.on('stateChange', this.onStateChange.bind(this));
        // this.on('objectChange', this.onObjectChange.bind(this));
        // this.on('message', this.onMessage.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }

    /**
     * Is called when databases are connected and adapter received configuration.
     */
    async onReady() {
        // Initialize your adapter here
        this.log.info('Init adapter');
        this.config = Object.assign({
            stationId:''
        }, this.config);

        this.log.debug(JSON.stringify(this.config));

        const forecastdef={
            'TTT': {
                'id':'Temperature.2m',
                'UnitOfMeasurement': 'K',
                'Description': 'Temperature 2m above surface'
            },
            'Td': {
                'id':'Dewpoint',
                'UnitOfMeasurement': 'K',
                'Description': 'Dewpoint (Kelvin) 2m above surface'
            },
            'T5cm': {
                'id': 'Temperature.5cm',
                'UnitOfMeasurement': 'K',
                'Description': 'Temperature (Kelvin) 5cm above surface'
            },
            'DD': {
                'id': 'Wind.Direction',
                'UnitOfMeasurement': '°',
                'Description': 'Wind direction (°)'
            },
            'FF': {
                'id': 'Wind.Speed',
                'UnitOfMeasurement': 'm/s',
                'Description': 'Wind speed (m/s)'
            },
            'N': {
                'id': 'CloudCover.Total',
                'UnitOfMeasurement': '%',
                'Description': 'Total cloud cover (%)'
            },
            'Neff': {
                'id': 'CloudCover.Effective',
                'UnitOfMeasurement': '%',
                'Description': 'Effective cloud cover (%)'
            },
            'N05': {
                'id': 'CloudCover.Below500Ft',
                'UnitOfMeasurement': '%',
                'Description': 'Cloud cover (%) below 500 ft.'
            },
            'Nl': {
                'id': 'CloudCover.Below2km',
                'UnitOfMeasurement': '%',
                'Description': 'Low cloud cover (%) (lower than 2 km)'
            },
            'Nm': {
                'id': 'CloudCover.2To7km',
                'UnitOfMeasurement': '%',
                'Description': 'Midlevel cloud cover (%) (2-7 km)'
            },
            'Nh': {
                'id': 'CloudCover.Over7km',
                'UnitOfMeasurement': '%',
                'Description': 'High cloud cover (%) (>7 km)'
            },
            'PPPP': {
                'id': 'Pressure',
                'UnitOfMeasurement': 'Pa',
                'Description': 'Surface pressure (Pa), reduced'
            },
            'VV': {
                'id': 'Visibility',
                'UnitOfMeasurement': 'm',
                'Description': 'Visibility (m)'
            },
            'SunD1': {
                'id': 'Sunshine',
                'UnitOfMeasurement': 's',
                'Description': 'Sunshine duration (s) during the last Hour'
            },
            'wwM': {
                'id': 'Fog',
                'UnitOfMeasurement': '%',
                'Description': 'Probability for fog (%) within the last hour'
            },
        };
        const getTempCelsius=(tempK)=>{
            return tempK - 273.15;
        };


        if (this.config.stationId.length>0){

            //Reading Station
            await mosmix.readStationForecast({ stationId: this.config.stationId, adapter:this}).then(async result=>{


                if (result.placemark){

                    const keys= Object.keys(result.placemark);
                    for (const index in keys){
                        const key = keys[index];
                        const id = `placemark.${key}`;
                        await this.setObjectNotExistsAsync(id, {
                            type: 'text',
                            common: {
                                read: true,
                                write: false,
                                type: 'string',
                            },
                            native: {},
                        }).then(()=>{
                            this.setState(id, result.placemark[key]);
                        });
                    }
                }


                if (result.coordinates){
                    const keys = Object.keys(result.coordinates);
                    for (const index in keys) {
                        const key = keys[index];
                        const id = `coordinates.${key}`;
                        await this.setObjectNotExistsAsync(id, {
                            type: 'text',
                            common: {
                                read: true,
                                write: false,
                                type: 'string'
                            },
                            native: {},
                        }).then(() => {
                            this.setState(id, result.coordinates[key]);
                        });
                    }
                }

                let id = `forecast.time.last`;
                await this.setObjectNotExistsAsync(id, {
                    type: 'date',
                    common: {
                        type: 'string',
                        read: true,
                        write: false,
                    },
                    native: {},
                }).then(() => {
                    this.setState(id, result.times[0]);
                });
                id = `forecast.time.next`;
                await this.setObjectNotExistsAsync(id, {
                    type: 'list',
                    common: {
                        type: 'array',
                        read: true,
                        write: false,
                    },
                    native: {},
                }).then(() => {
                    this.setState(id, result.times);
                });

                const keys = Object.keys(result.forecast);
                for (const index in keys) {
                    const measureId = keys[index];
                    if (forecastdef[measureId]) {
                        const baseid = `forecast.${forecastdef[measureId].id}`;
                        const isKelvin = (forecastdef[measureId].UnitOfMeasurement == 'K');
                        const valid = `${baseid}.${isKelvin ? 'Kelvin.value' : 'value'}`;
                        await this.setObjectNotExistsAsync(valid, {
                            type: 'state',
                            common: {
                                read: true,
                                type: 'value',
                                write: false,
                                name: forecastdef[measureId].Description
                            },
                            native: {},
                        }).then(() => {
                            this.setState(valid, result.forecast[measureId][0]);
                        });

                        const forecastid = `${baseid}.${isKelvin ? 'Kelvin.forecast' : 'forecast'}`;
                        await this.setObjectNotExistsAsync(forecastid, {
                            type: 'state',
                            common: {
                                read: true,
                                type: 'array',
                                write: false,
                                name: forecastdef[measureId].Description
                            },
                            native: {},
                        }).then(() => {
                            this.setState(forecastid, result.forecast[measureId]);
                        });


                        if (isKelvin) {
                            //Celsius Value
                            const cvalid = `${baseid}.Celsius.value`;
                            await this.setObjectNotExistsAsync(cvalid, {
                                type: 'state',
                                common: {
                                    read: true,
                                    type: 'value',
                                    write: false,
                                    name: forecastdef[measureId].Description.replace('(Kelvin)', '(°C)')
                                },
                                native: {},
                            }).then(() => {
                                this.setState(cvalid, getTempCelsius(result.forecast[measureId][0]));
                            });

                            const cforecastid = `${baseid}.Celsius.forecast`;
                            await this.setObjectNotExistsAsync(cforecastid, {
                                type: 'state',
                                common: {
                                    read: true,
                                    type: 'array',
                                    write: false,
                                    name: forecastdef[measureId].Description
                                },
                                native: {},
                            }).then(() => {
                                this.setState(cforecastid, result.forecast[measureId].map(kelvin=>{
                                    return getTempCelsius(kelvin);
                                }));
                            });
                        }

                    }
                }

            });
        }

        // // In order to get state updates, you need to subscribe to them. The following line adds a subscription for our variable we have created above.
        // this.subscribeStates('testVariable');
        // // You can also add a subscription for multiple states. The following line watches all states starting with "lights."
        // // this.subscribeStates('lights.*');
        // // Or, if you really must, you can also watch all states. Don't do this if you don't need to. Otherwise this will cause a lot of unnecessary load on the system:
        // // this.subscribeStates('*');

        // /*
        //     setState examples
        //     you will notice that each setState will cause the stateChange event to fire (because of above subscribeStates cmd)
        // */
        // // the variable testVariable is set to true as command (ack=false)
        // await this.setStateAsync('testVariable', true);

        // // same thing, but the value is flagged "ack"
        // // ack should be always set to true if the value is received from or acknowledged from the target system
        // await this.setStateAsync('testVariable', { val: true, ack: true });

        // // same thing, but the state is deleted after 30s (getState will return null afterwards)
        // await this.setStateAsync('testVariable', { val: true, ack: true, expire: 30 });

        // // examples for the checkPassword/checkGroup functions
        // let result = await this.checkPasswordAsync('admin', 'iobroker');
        // this.log.info('check user admin pw iobroker: ' + result);

        // result = await this.checkGroupAsync('admin', 'admin');
        // this.log.info('check group user admin group admin: ' + result);
        this.terminate();
    }

    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     * @param {() => void} callback
     */
    onUnload(callback) {
        try {
            // Here you must clear all timeouts or intervals that may still be active
            // clearTimeout(timeout1);
            // clearTimeout(timeout2);
            // ...
            // clearInterval(interval1);

            callback();
        } catch (e) {
            callback();
        }
    }

    // If you need to react to object changes, uncomment the following block and the corresponding line in the constructor.
    // You also need to subscribe to the objects with `this.subscribeObjects`, similar to `this.subscribeStates`.
    // /**
    //  * Is called if a subscribed object changes
    //  * @param {string} id
    //  * @param {ioBroker.Object | null | undefined} obj
    //  */
    // onObjectChange(id, obj) {
    //     if (obj) {
    //         // The object was changed
    //         this.log.info(`object ${id} changed: ${JSON.stringify(obj)}`);
    //     } else {
    //         // The object was deleted
    //         this.log.info(`object ${id} deleted`);
    //     }
    // }

    /**
     * Is called if a subscribed state changes
     * @param {string} id
     * @param {ioBroker.State | null | undefined} state
     */
    onStateChange(id, state) {
        if (state) {
            // The state was changed
            this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
        } else {
            // The state was deleted
            this.log.info(`state ${id} deleted`);
        }
    }

    // If you need to accept messages in your adapter, uncomment the following block and the corresponding line in the constructor.
    // /**
    //  * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
    //  * Using this method requires "common.messagebox" property to be set to true in io-package.json
    //  * @param {ioBroker.Message} obj
    //  */
    // onMessage(obj) {
    //     if (typeof obj === 'object' && obj.message) {
    //         if (obj.command === 'send') {
    //             // e.g. send email or pushover or whatever
    //             this.log.info('send command');

    //             // Send response in callback if required
    //             if (obj.callback) this.sendTo(obj.from, obj.command, 'Message received', obj.callback);
    //         }
    //     }
    // }

}

// @ts-ignore parent is a valid property on module
if (module.parent) {
    // Export the constructor in compact mode
    /**
     * @param {Partial<utils.AdapterOptions>} [options={}]
     */
    module.exports = (options) => new Template(options);
} else {
    // otherwise start the instance directly
    new Template();
}