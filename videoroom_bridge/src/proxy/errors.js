'use strict';

const _ = require('lodash');

class ResponseError extends Error {

    constructor(res) {
        super();
        this.name = this.constructor.name;
        this.message = _.get(res.getResponse(), 'error.reason', null);
        this.code = _.get(res.getResponse(), 'error.code', null);
        this.resposne = res;
    }

    getCode() {
        return this.code;
    }

    getMessage() {
        return this.message;
    }

    getResponse() {
        return this.resposne;
    }
}

class PluginError extends ResponseError {

    constructor(res, handle) {
        super(res);
        this.message = _.get(res.getResponse(), 'plugindata.data.error', null);
        this.code = _.get(res.getResponse(), 'plugindata.data.error_code', null);
        this.handle = handle;
    }

    getHandle() {
        return this.handle;
    }
}

class RequestTimeoutError extends Error {

    constructor(req) {
        super();
        this.name = this.constructor.name;
        this.message = 'Request timeout';
        this.request = req;
    }
}

module.exports.ResponseError = ResponseError;
module.exports.RequestTimeoutError = RequestTimeoutError;
module.exports.PluginError = PluginError;