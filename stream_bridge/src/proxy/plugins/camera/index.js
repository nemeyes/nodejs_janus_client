'use strict';

const _ = require('lodash');
const Plugin = require('../plugin').Plugin;
const CameraHandle = require('./handle').CameraHandle;

class CameraPlugin extends Plugin {

    constructor(options) {
        super();
        this.name = 'streaming';
        this.fullName = 'janus.plugin.' + this.name;
        this.session = options.session;
        this.$defaultHandle = null;
    }

    defaultHandle(options) {
        return new Promise((resolve, reject)=>{
            if(this.$defaultHandle === null) {
                this.createCameraHandle(options)
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

    createCameraHandle(options) {
        return new Promise((resolve, reject)=>{
            this.createHandle(options)
            .then((id)=>{
                this.addHandle(new CameraHandle({
                    id: id,
                    plugin: this
                }));
                resolve(this.getHandle(id));
            }).catch((err)=>{
                reject(err);
            });
        });
    }

    attachCameraHandle(handleId, opaqueId) {
        return new Promise((resolve)=>{
            this.addHandle(new CameraHandle({
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

module.exports.CameraPlugin = CameraPlugin;
