'use strict';

const Client = require('./proxy').Proxy;
const express = require('express');
const app = express();

function createCooperation(client, roomId, nPublisher, pinSecret) {
    return new Promise((resolve, reject) => {
        client.onConnected(()=>{
            client.createSession().then((session)=>{
                return session.cooperation().createCooperationHandle();
            }).then((cooperHandle) => {

                if(!pinSecret) {
                    cooperHandle.create({
                        room: roomId,
                        publishers: nPublisher,
                        is_private: false,
                        audiocodec: 'opus',
                        videocodec: 'vp8',
                        record: false
                    }).then((result) => {
                        var roomId = result.room;
                        console.log("create room["+ roomId +"] is completed"); 
                        resolve("success");
                    }).catch((err) => {
                        console.log("Room is already Exist");
                        resolve("exist");
                    });
                } else {
                    console.log("create with pin " + pinSecret);
                    cooperHandle.create({
                        room: roomId,
                        publishers: nPublisher,
                        is_private: false,
                        pin: pinSecret,
                        audiocodec: 'opus',
                        videocodec: 'vp8',
                        record: false
                    }).then((result) => {
                        var roomId = result.room;
                        console.log("create room["+ roomId +"] is completed"); 
                        resolve("success");
                    }).catch((err) => {
                        console.log("Room is already Exist");
                        resolve("exist");
                    });                }


            }).catch((err) => {
                reject(err);
            })
        });
        client.onDisconnected(() => {
            //console.log("onDisconnected"); 
         });
         
         client.onError((err) => {
             console.log(err); 
         });
    });
}

function destroyCooperation(client, roomId) {
    return new Promise((resolve, reject) => {
        client.onConnected(()=>{
            client.createSession().then((session)=>{
                return session.cooperation().createCooperationHandle();
            }).then((cooperHandle) => {
                cooperHandle.destroy({
                    room: roomId
                }).then((result) => {
                    var roomId = result.room;
                    console.log("destory room[" + roomId +"]");
                    resolve("success");
                }).catch((err) => {
                    resolve("noroom");
                });
            }).catch((err) => {
                reject(err);
            })
        });
        client.onDisconnected(() => {
            //console.log("onDisconnected"); 
         });
         
         client.onError((err) => {
             console.log(err); 
         });
    });
}

function listCooperation(client) {
    return new Promise((resolve, reject) => {
        client.onConnected(()=>{
            client.createSession().then((session)=>{
                return session.cooperation().createCooperationHandle();
            }).then((cooperHandle) => {
                cooperHandle.list()
                .then((result) => {
                    var roomList = result.list;
                    var rooms = [];
                    for(let i=0; i<roomList.length; i++) {
                        rooms.push(roomList[i].room);
                        //console.log("room[" + roomList[i].room + "] is exist");
                    }
                    resolve(rooms);
                }).catch((err) => {
                    reject(err);
                });
            }).catch((err) => {
                reject(err);
            })
        });
        client.onDisconnected(() => {
            //console.log("onDisconnected"); 
         });
         
         client.onError((err) => {
             console.log(err); 
         });
    });
}


function listParticipantsCooperation(client, roomId) {
    return new Promise((resolve, reject) => {
        client.onConnected(()=>{
            client.createSession().then((session)=>{
                return session.cooperation().createCooperationHandle();
            }).then((cooperHandle) => {
                cooperHandle.listParticipants({room: roomId})
                .then((result) => {
                    var participantList = result.participants;
                    var participants = [];
                    
                    for(let i=0; i<participantList.length; i++) {
                        var participant = {id: participantList[i].id, code: participantList[i].display}
                        participants.push(participant);
                        //console.log("room[" + roomList[i].room + "] is exist");
                    }
                    let value = {code: "success", room: roomId, participants: participants};
                    resolve(value);
                }).catch((err) => {
                    let value = {code: "noroom"};
                    resolve(value);
                });
            }).catch((err) => {
                reject(err);
            })
        });
        client.onDisconnected(() => {
            //console.log("onDisconnected"); 
         });
         
         client.onError((err) => {
             console.log(err); 
         });
    });
}

app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.post('/Room/Create', (req, res) => {
    const { room, publishers, pin } = req.body;

    let client = new Client({
        url: 'ws://52.79.247.10:8188'
    });
    createCooperation(client, room, publishers, pin)
        .then((value) => {
            res.json({"code": value});
            client.disconnect();
        });

    client.connect();
});

app.post('/Room/Destroy', (req, res) => {
    const { room } = req.body;

    let client = new Client({
        url: 'ws://52.79.247.10:8188'
    });
    destroyCooperation(client, room)
        .then((value) => {
            res.json({"code": value});
            client.disconnect();
        });

    client.connect();
});

app.get('/Room/List', (req, res) => {

    let client = new Client({
        url: 'ws://52.79.247.10:8188'
    });
    listCooperation(client)
        .then((value) => {
            res.json({"code": "success", "rooms": value});
            client.disconnect();
        });

    client.connect();
});

app.post('/Room/ListParticipants', (req, res) => {
    const { room } = req.body;

    let client = new Client({
        url: 'ws://52.79.247.10:8188'
    });
    listParticipantsCooperation(client, room)
        .then((value) => {
            res.json(value);
            client.disconnect();
        });

    client.connect();
});

app.listen(3030, () => console.log("media server bridge server"));

/*
var Client = require('./proxy').Proxy;

var client = new Client({
    url: 'ws://52.79.247.10:8188'
});


client.onConnected(()=>{
    client.createSession().then((session)=>{
        console.log("create session is completed");  
        return session.cooperation().createCooperationHandle();
    }).then((cooperHandle) => {
        
        console.log("destory room");
        cooperHandle.destroy({
            room: 123456
        }).then((result) => {
            var roomId = result.room;
            console.log("destory room[" + roomId +"]");
            client.disconnect();
        }).catch((err) => {
            console.log("No such room");
            client.disconnect();
        });
        
        console.log("create room");
        cooperHandle.create({
            room: 123456,
            publishers: 3,
            is_private: false,
            audiocodec: 'opus',
            videocodec: 'vp8',
            record: false
        }).then((result) => {
            var roomId = result.room;
            console.log("create room["+ roomId +"] is completed"); 
        }).catch((err) => {
            console.log("Room is already Exist");
        });

        console.log("list room");
        cooperHandle.list()
        .then((result) => {
            var roomList = result.list;
            for(let i=0; i<roomList.length; i++) {
                console.log("room[" + roomList[i].room + "] is exist");
            }
        }).catch((err) => {
            console.log(err);
        });

    }).catch((err)=>{
        console.log(err);
    })
});

client.onDisconnected(()=>{
   console.log("onDisconnected"); 
});

client.onError((err)=>{
    console.log(err); 
});


client.connect();
*/

