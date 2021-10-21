'use strict';

const _ = require('lodash');
const Plugin = require('../plugin').Plugin;
const CooperationHandle = require('./handle').CooperationHandle;

class CooperationPlugin extends Plugin {

    constructor(options) {
        super();
        this.name = 'videoroom';
        this.fullName = 'janus.plugin.' + this.name;
        this.session = options.session;
        this.$defaultHandle = null;
    }

    defaultHandle(options) {
        return new Promise((resolve, reject)=>{
            if(this.$defaultHandle === null) {
                this.createCooperationHandle(options)
                .then((handle)=>{
                    this.$defaultHandle = handle;
                    resolve(this.$defaultHandle);
                }).catch((err)=>{
                    reject(err);
                });
            } else {
                resolve(this.$defaultHandle);
            }
        });
    }

    createCooperationHandle(options) {
        return new Promise((resolve, reject)=>{
            this.createHandle(options)
            .then((id)=>{
                this.addHandle(new CooperationHandle({
                    id: id,
                    plugin: this
                }));
                resolve(this.getHandle(id));
            }).catch((err)=>{
                reject(err);
            });
        });
    }

    attachCooperationHandle(handleId, opaqueId) {
        return new Promise((resolve)=>{
            this.addHandle(new CooperationHandle({
                id: handleId,
                plugin: this,
                opaqueId: opaqueId
            }));
            let defaultHandle = this.getHandle(handleId);
            this.$defaultHandle = defaultHandle;
            resolve(defaultHandle);
        });
    }
}

module.exports.CooperationPlugin = CooperationPlugin;
