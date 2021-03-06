'use strict';

const assert = require('chai').assert;
const _ = require('lodash');

class ProxyResponse {

    constructor(req, res) {
        assert.property(req, 'janus', 'Missing property janus in request');
        assert.property(res, 'janus', 'Missing property janus in response');
        this.request = req;
        this.response = res;
    }

    getRequest() {
        return this.request;
    }

    getResponse() {
        return this.response;
    }

    getType() {
        return _.get(this.response, 'janus', null);
    }

    getJsep() {
        return _.get(this.response, 'jsep', null);
    }

    isError() {
        return this.getType() === 'error';
    }

    isAck() {
        return this.getType() === 'ack';
    }

    isSuccess() {
        return this.getType() === 'success';
    }
}

class PluginResponse extends ProxyResponse {

    constructor(req, res) {
        super(req, res);
    }

    isError() {
        return _.get(this.response, 'plugindata.data.error_code', null) !== null;
    }

    getName() {
        return _.get(this.response, 'plugindata.plugin', null);
    }

    getData() {
        return _.get(this.response, 'plugindata.data', null);
    }
}

module.exports.ProxyResponse = ProxyResponse;
module.exports.PluginResponse = PluginResponse;