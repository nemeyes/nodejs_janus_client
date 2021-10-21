'use strict';

const assert = require('chai').assert;
const _ = require('lodash');
const WebSocket = require('isomorphic-ws');
const EventEmitter = require('events').EventEmitter;
const Transaction = require('./transaction').Transaction;
const logger = require('debug-logger')('mediaserver:proxy');
const ProxyResponse = require('./response').ProxyResponse;
const Session = require('./session').Session;
const ResponseError = require('./errors').ResponseError;
const JanusEvents = require('./constants').JanusEvents;

const ConnectionState = {
    connected: 'connected',
    disconnected: 'disconnected'
};

const ProxyEvent = {
    connected: 'connected',
    disconnected: 'disconnected',
    object: 'object',
    error: 'error',
    timeout: 'timeout',
    event: 'event'
};

const WebSocketEvent = {
    open: 'open',
    message: 'message',
    error: 'error',
    close: 'close'
};

class ConnectionStateError extends Error {

    constructor(proxy) {
        super();
        this.name = this.constructor.name;
        this.message = 'Wrong connection state';
        this.proxy = proxy;
        this.state = proxy.getConnectionState();
    }
}

class Proxy {

    constructor(options) {
        options = options || {};
        this.url = _.get(options, 'url', 'ws://localhost:8188');
        this.logger = _.get(options, 'logger', logger);
        this.requestTimeout = options.requestTimeout || 6000;
        this.protocol = 'janus-protocol';
        this.webSocket = null;
        this.WebSocket = _.get(options, 'WebSocket', WebSocket);
        this.emitter = new EventEmitter();
        this.transactions = {};
        this.connectionTimeoutTimer = null;
        this.connectionTimeout = options.connectionTimeout || 40000;
        this.lastConnectionEvent = ProxyEvent.disconnected;
        this.sessions = {};
        this.hasInfo = false;
        this.info = {};
        this.reconnect = _.isBoolean(options.reconnect)? options.reconnect : true;
        this.token = _.get(options, 'token', null);
        this.apiSecret = _.get(options, 'apiSecret', null);
        this.handshakeTimeout = _.get(options, 'handshakeTimeout', undefined);
    }

    getVersion() {
        return (this.hasInfo)? this.info.version_string : '';
    }

    isConnected() {
        return _.isObject(this.webSocket) && this.webSocket.readyState === 1;
    }

    isConnecting() {
        return _.isObject(this.webSocket) && this.webSocket.readyState === 0;
    }

    isClosing() {
        return _.isObject(this.webSocket) && this.webSocket.readyState === 2;
    }

    connect() {
        if(this.webSocket === null) {
            var opts = this.handshakeTimeout ?
                { handshakeTimeout: this.handshakeTimeout } :
                undefined;

            this.webSocket = new this.WebSocket(this.url, this.protocol, opts);
            this.webSocket.onopen = ()=>{ this.open(); };
            this.webSocket.onclose = ()=>{ this.close(); };
            this.webSocket.onmessage = (message)=>{ this.message(message); };
            this.webSocket.onerror = (err)=>{ this.error(err); };
            this.startConnectionTimeout();
        }
    }

    disconnect() {
        Object.values(this.sessions).forEach(session => {
            session.stopKeepAlive();
        });
        this.close();
    }

    open() {
        if(this.isConnected() && this.lastConnectionEvent === ProxyEvent.disconnected) {
            this.lastConnectionEvent = ProxyEvent.connected;
            this.getInfo().then((info)=>{
                this.info = info.getResponse();
                this.emitter.emit(ProxyEvent.connected);
            }).catch((err)=>{
                this.error(err);
            });
        }
    }

    close(options) {
        // When the connection finishes closing the onClose event handler
        // will re-trigger this clean up.
        if (this.isClosing()) { return; }

        let connect = _.get(options, 'connect', false);

        let closeHandler = ()=>{
            this.stopConnectionTimeout();
            if(this.webSocket !== null) {
                this.webSocket.onopen = null;
                this.webSocket.onclose = null;
                this.webSocket.onmessage = null;
                this.webSocket.onerror = null;
                this.webSocket = null;
            }
            if(this.lastConnectionEvent === ProxyEvent.connected) {
                this.lastConnectionEvent = ProxyEvent.disconnected;
                this.emitter.emit(ProxyEvent.disconnected);
            }
            if(connect === true) {
                this.connect();
            }
        };

        if(this.isConnected() || this.isConnecting()) {
            if (typeof this.webSocket.removeAllListeners === "function") {
                this.webSocket.removeAllListeners('close');
            } else {
                this.webSocket.onclose = null;
            }
            this.webSocket.onclose = () => closeHandler();
            this.webSocket.close();
        } else {
            closeHandler();
        }
    }

    message(message) {
        this.startConnectionTimeout();
        let parsedMessage = message.data;
        try {
            if(_.isString(message.data)) {
                parsedMessage = JSON.parse(message.data);
            }
            this.logger.debug('Received message', parsedMessage);
            this.dispatchObject(parsedMessage);
        } catch(err) {
            this.emitter.emit(ProxyEvent.error, err);
        }
    }

    error(err) {
        this.emitter.emit(ProxyEvent.error, err);
    }

    getConnectionState() {
        return (this.isConnected())? ConnectionState.connected : ConnectionState.disconnected;
    }

    setConnectionTimeout(timeout) {
        this.connectionTimeout = timeout;
        if(this.connectionTimeoutTimer !== null) {
            this.startConnectionTimeout();
        }
    }

    startConnectionTimeout() {
        this.stopConnectionTimeout();
        this.connectionTimeoutTimer = setTimeout(()=>{
            this.close({
                connect: this.reconnect
            });
        }, this.connectionTimeout);
    }

    stopConnectionTimeout() {
        if(this.connectionTimeoutTimer !== null) {
            clearTimeout(this.connectionTimeoutTimer);
        }
    }

    dispatchObject(obj) {
        let transactionId = _.get(obj, 'transaction', null);
        let transaction;
        let response;
        if(transactionId !== null && this.transactions[transactionId] instanceof Transaction) {
            transaction = this.transactions[obj.transaction];
            response = new ProxyResponse(transaction.getRequest(), obj);
            transaction.response(response);
        } else if (transactionId !== null) {
            logger.warn('Rejected response due to none existing session', obj);
        } else {
            this.delegateEvent(obj);
        }
    }

    delegateEvent(event) {
        let sessionId = _.get(event, 'session_id', null);
        if(sessionId !== null && this.hasSession(sessionId)) {
            switch(event.janus) {
                case JanusEvents.timeout:
                    this.deleteSession(sessionId);
                    break;
                default:
                    this.sessions[sessionId].event(event);
                    break;
            }
        } else {
            logger.info('Rejected event due to none existing session', event);
        }
    }

    sendObject(obj) {
        return new Promise((resolve, reject)=>{
            assert.isObject(obj);
            if(this.isConnected()) {
                this.webSocket.send(JSON.stringify(obj));
                resolve();
            } else {
                reject(new ConnectionStateError(this));
            }
        });
    }

    createTransaction(options) {
        if(this.token !== null) {
            options.request.token = this.token;
        }
        if(this.apiSecret !== null) {
            options.request.apisecret = this.apiSecret;
        }
        let transaction = new Transaction(options);
        this.transactions[transaction.getId()] = transaction;
        return transaction;
    }

    request(req, options) {
        return new Promise((resolve, reject)=>{
            let ack = _.get(options, 'ack', false);
            let transaction = this.createTransaction({
                request: req,
                proxy: this,
                ack: ack
            });
            transaction.onResponse((res)=>{
                resolve(res);
            }).onError((err)=>{
                reject(err);
            }).onEnd(()=>{
                delete this.transactions[transaction.getId()];
            }).start();
        });
    }

    hasSession(id) {
        return this.sessions[id] instanceof Session;
    }

    addSession(session) {
        this.sessions[session.getId()] = session;
    }

    deleteSession(id) {
        delete this.sessions[id];
        this.logger.info('Deleted session=%s', id);
        this.logger.info('Sessions count=%s', Object.keys(this.sessions).length);
    }

    createSession() {
        return new Promise((resolve, reject)=>{
            this.request({ janus: 'create' }).then((res)=>{
                if(res.isSuccess()) {
                    let session = new Session(res.getResponse().data.id, this);
                    this.addSession(session);
                    this.logger.info('Created session=%s',session.getId());
                    session.onKeepAlive((result)=>{
                        if(result) {
                            this.logger.debug('KeepAlive session=%s', session.getId());
                        } else {
                            this.logger.warn('KeepAlive failed session=%s', session.getId());
                        }
                    });
                    session.onTimeout(()=>{
                        this.logger.info('Timeout session=%s',session.getId());
                        this.deleteSession(session.getId());
                    });
                    resolve(session);
                } else {
                    reject(new ResponseError(res));
                }
            }).catch((err)=>{
                reject(err);
            });
        });
    }

    claimSession(sessionId) {
        return new Promise((resolve, reject)=>{
            this.request({
                janus: 'claim',
                session_id: sessionId
            }).then((res)=>{
                if(res.isSuccess()) {
                    let session = new Session(res.getResponse().session_id, this);
                    this.addSession(session);
                    this.logger.info('Claimed session=%s',session.getId());
                    session.onKeepAlive((result)=>{
                        if(result) {
                            this.logger.debug('KeepAlive session=%s', session.getId());
                        } else {
                            this.logger.warn('KeepAlive failed session=%s', session.getId());
                        }
                    });
                    session.onTimeout(()=>{
                        this.logger.info('Timeout session=%s',session.getId());
                        this.deleteSession(session.getId());
                    });
                    resolve(session);
                } else {
                    reject(new ResponseError(res));
                }
            }).catch((err)=>{
                reject(err);
            });
        });
    }

    destroySession(id) {
        return new Promise((resolve, reject)=>{
            this.request({
                janus: 'destroy',
                session_id: id
            }).then((res)=>{
                if(res.isSuccess()) {
                    this.deleteSession(id);
                    resolve();
                } else {
                    reject(new ResponseError(res));
                }
            }).catch((err)=>{
                reject(err);
            });
        });
    }

    getInfo() {
        return new Promise((resolve, reject)=>{
            this.request({ janus: 'info' }).then((res)=>{
                if(res.getType() === 'server_info') {
                    this.hasInfo = true;
                    resolve(res);
                } else {
                    reject(new ResponseError(res));
                }
            }).catch((err)=>{
                reject(err);
            });
        });
    }

    onConnected(listener) {
        this.emitter.on(ProxyEvent.connected, listener);
    }

    onDisconnected(listener) {
        this.emitter.on(ProxyEvent.disconnected, listener);
    }

    onError(listener) {
        this.emitter.on(ProxyEvent.error, listener);
    }

    onEvent(listener) {
        this.emitter.on(ProxyEvent.event, listener);
    }
}

module.exports.Proxy = Proxy;
module.exports.ProxyEvent = ProxyEvent;
module.exports.ConnectionState = ConnectionState;
module.exports.ConnectionStateError = ConnectionStateError;
module.exports.WebSocketEvent = WebSocketEvent;