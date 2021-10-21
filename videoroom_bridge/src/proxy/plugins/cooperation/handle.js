'use strict'

const _ = require('lodash');
const assert = require('chai').assert;
const PluginHandle = require('../handle').PluginHandle;

class CooperationHandle extends PluginHandle {

    constructor(options) {
        super(options);
    }

    create(options) {
        return new Promise((resolve, reject)=>{
            options = options || {};
            let message = _.merge({
                request: 'create'
            }, options);
            this.requestMessage(message).then((res)=>{
                resolve({
                    room: res.getData().room,
                    response: res
                });
            }).catch((err)=>{
                reject(err);
            });
        });
    }

    destroy(options) {
        return new Promise((resolve, reject)=>{
            assert.property(options, 'room');
            options.room = parseInt(options.room + "");
            let message = _.merge({
                request: 'destroy'
            }, options);
            this.requestMessage(message).then((res)=>{
                resolve({
                    room: res.getData().room,
                    response: res
                });
            }).catch((err)=>{
                reject(err);
            });
        });
    }

    exists(options) {
        return new Promise((resolve, reject)=>{
            assert.property(options, 'room');
            options.room = parseInt(options.room + "");
            let message = _.merge({
                request: 'exists'
            }, options);
            this.requestMessage(message).then((res)=>{
                resolve({
                    exists: (res.getData().exists === 'true' || res.getData().exists === true),
                    response: res
                });
            }).catch((err)=>{
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
            }).catch((err)=>{
                reject(err);
            });
        });
    }

    listParticipants(options) {
        return new Promise((resolve, reject)=>{
            assert.property(options, 'room');
            options.room = parseInt(options.room + "");
            let message = _.merge({
                request: 'listparticipants'
            }, options);
            this.requestMessage(message).then((res)=>{
                resolve({
                    participants: res.getData().participants || [],
                    response: res
                });
            }).catch((err)=>{
                reject(err);
            });
        });
    }
}

module.exports.CooperationHandle = CooperationHandle;

