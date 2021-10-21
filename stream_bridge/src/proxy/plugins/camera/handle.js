'use strict'

const _ = require('lodash');
const assert = require('chai').assert;
const PluginHandle = require('../handle').PluginHandle;

class CameraHandle extends PluginHandle {

    constructor(options) {
        super(options);
    }

    create(options) {
        return new Promise((resolve, reject)=>{
            options = options || {};
            let message = _.merge({
                request: 'create',
                type: 'rtsp',
                video: true
            }, options);
            this.requestMessage(message).then((res)=>{
                resolve({
                    id: res.getData().created,
                    response: res
                });
            }).catch((err) => { 
                reject(err);
            });
        });
    }

    destroy(options) {
        return new Promise((resolve, reject)=>{
            let message = _.merge({
                request: 'destroy'
            }, options);
            this.requestMessage(message).then((res)=>{
                resolve({
                    id: res.getData().destroyed,
                    response: res
                });
            }).catch((err) => {
                reject(err);
            });
        });
    }

    list() {
        return new Promise((resolve, reject)=>{
            this.requestMessage({
                request: 'list'
            }).then((res)=>{
                resolve({
                    list: res.getData().list || [],
                    response: res
                });
            }).catch((err) => {
                reject(err);
            });
        });
    }
}

module.exports.CameraHandle = CameraHandle;

