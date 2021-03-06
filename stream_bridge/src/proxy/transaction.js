'use strict'

const _ = require('lodash');
const CreateID = require('uuid');
const EventEmitter = require('events').EventEmitter;
const ResponseError = require('./errors').ResponseError;
const ProxyResponse = require('./response').ProxyResponse;
const assert = require('chai').assert;

const State = {
    new: 'new',
    started: 'started',
    sent: 'sent',
    receiving: 'receiving',
    ended: 'ended'
};

const Event = {
    response: 'response',
    ack: 'ack',
    end: 'end',
    error: 'error'
};

class InvalidTransactionState extends Error {

    constructor(transaction) {
        super();
        this.name = this.constructor.name;
        this.message = 'Invalid transaction state ' + transaction.getState();
        this.state = transaction.getState();
        this.transaction = transaction;
    }
}

class TransactionTimeoutError extends Error {

    constructor(transaction, timeout) {
        super();
        this.name = this.constructor.name;
        this.message = 'Transaction timeout ' + timeout;
        this.transaction = transaction;
        this.timeout = timeout;
    }
}

class Transaction {

    constructor(options) {
        assert.property(options, 'request');
        assert.property(options, 'proxy');
        assert.property(options.request, 'janus');
        this.id = CreateID();
        this.request = options.request;
        this.proxy = options.proxy;
        this.emitter = new EventEmitter();
        this.state = State.new;
        this.timeoutTimer = null;
        this.timeout = _.get(options, 'timeout', 12000);
        this.ack = _.get(options, 'ack', false);
        _.set(this.request, 'transaction', this.id);
        this.ackReceived = false;
        this.responseReceived = false;
        this.lateAck = false;
    }

    isLateAck() {
        return this.lateAck;
    }

    getId() {
        return this.id;
    }

    getRequest() {
        return this.request;
    }

    getState() {
        return this.state;
    }

    start() {
        if(this.state === State.new) {
            this.state = State.started;
            this.startTimeout();
            try {
                this.proxy.sendObject(this.getRequest());
                this.emitter.emit('sent', this.getRequest());
            } catch (err) {
                this.error(err);
            }
        } else {
            this.error(new InvalidTransactionState(this));
        }
        return this;
    }

    response(res) {
        assert.instanceOf(res, ProxyResponse);
        assert.property(res.getResponse(), 'transaction', 'Missing transaction id');
        assert.equal(res.getResponse().transaction, this.getId(), 'Invalid transaction id');
        if(this.state === State.started || this.state === State.receiving) {
            this.state = State.receiving;
            if(res.isError()) {
                this.error(new ResponseError(res));
            } else if(this.ack === true && res.isAck()) {

                this.ackReceived = true;
                this.emitter.emit(Event.ack, res);
                if(this.responseReceived === true) {
                    this.lateAck = true;
                    this.end();
                } else {
                    this.startTimeout();
                }

            } else {

                this.responseReceived = true;
                this.emitter.emit(Event.response, res);
                if(this.ack === true && this.ackReceived === false) {
                    this.startTimeout();
                } else {
                    this.end();
                }
            }
        } else {
            this.error(new InvalidTransactionState(this));
        }
    }

    end() {
        this.stopTimeout();
        if(this.state !== State.ended) {
            this.state = State.ended;
            this.emitter.emit(Event.end);
        }
    }

    error(err) {
        this.end();
        this.emitter.emit(Event.error, err);
    }

    onSent(listener) {
        this.emitter.on('sent', listener);
        return this;
    }

    onAck(listener) {
        this.emitter.on('ack', listener);
        return this;
    }

    onResponse(listener) {
        this.emitter.on(Event.response, listener);
        return this;
    }

    onEnd(listener) {
        this.emitter.on(Event.end, listener);
        return this;
    }

    onError(listener) {
        this.emitter.on(Event.error, listener);
        return this;
    }

    getTimeout() {
        return this.timeout;
    }

    startTimeout() {
        this.stopTimeout();
        this.timeoutTimer = setTimeout(()=> {
            this.error(new TransactionTimeoutError(this, this.getTimeout()));
        }, this.getTimeout());
    }

    stopTimeout() {
        if(this.timeoutTimer !== null) {
            clearTimeout(this.timeoutTimer);
        }
    }
}

module.exports.Transaction = Transaction;
module.exports.TransactionTimeoutError = TransactionTimeoutError;
module.exports.InvalidTransactionState = InvalidTransactionState;
module.exports.TransactionState = State;