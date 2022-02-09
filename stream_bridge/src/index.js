const Client = require('./proxy').Proxy;
const express  = require('express');
const Cam = require('onvif').Cam;
const app = express();

function createCamera(client, name, url, description, pin) {
    return new Promise((resolve, reject) => {
        client.onConnected(()=>{
            client.createSession().then((session)=>{
                return session.camera().createCameraHandle();
            }).then((cameraHandle) => {

                if(!pin) {
                    cameraHandle.create({
			"name": name,
                        "url": url,
                        "description": description,
                    }).then((result) => {
                        console.log("add camera["+ result.id +"] is completed"); 
			var value = {code: "success", id: result.id, name: result.name};
			resolve(value);
                    }).catch((err) => {
                        //console.log("Room is already Exist");
                        //console.log(err);
			var value = {code: "fail", id: -1};
                        resolve(value);
                    });
                } else {
                    console.log("create with pin " + pin);
                    cameraHandle.create({
			"name": name,
                        "url": url,
                        "description": description,
                        "pin": pin
                    }).then((result) => {
                        console.log("add camera["+ id +"] is completed"); 
			var value = {code: "success", id: result.id, name: result.name};
                        resolve(value);
                    }).catch((err) => {
			//console.log(err);
                        //console.log("Room is already Exist");
			var value = {code: "fail", id: -1};
                        resolve(value);
                    });                
		}

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

function destroyCamera(client, id) {
    return new Promise((resolve, reject) => {
        client.onConnected(()=>{
            client.createSession().then((session)=>{
                return session.camera().createCameraHandle();
            }).then((cameraHandle) => {
                cameraHandle.destroy({
                    "id": id
                }).then((result) => {
                    var id = result.id;
                    console.log("remove camera[" + id +"]");
                    resolve("success");
                }).catch((err) => {
                    resolve("nocamera");
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

function getCamera(client, id) {
    return new Promise((resolve, reject) => {
        client.onConnected(()=>{
            client.createSession().then((session)=>{
                return session.camera().createCameraHandle();
            }).then((cameraHandle) => {
                cameraHandle.info({
                    "id": id
                }).then((result) => {
                    resolve({code: "success", id: result.id, name: result.name, description: result.description, url: result.url});
                }).catch((err) => {
                    resolve({code: "nocamera"});
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

function listCamera(client) {
    return new Promise((resolve, reject) => {
        client.onConnected(()=>{
            client.createSession().then((session)=>{
                return session.camera().createCameraHandle();
            }).then((cooperHandle) => {
                cooperHandle.list()
                .then((result) => {
                    var cameraList = result.list;
                    var cameras = [];
                    for(let i=0; i<cameraList.length; i++) {
                        cameras.push({ id: cameraList[i].id, description: cameraList[i].description });
                        //console.log("room[" + roomList[i].room + "] is exist");
                    }
                    resolve(cameras);
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

app.use(express.json());
app.use(express.urlencoded({ extended: true}));
app.post("/PTZ/Move", (req, res) => {
	const { host, port, id, pwd, param } = req.body	

	new Cam({hostname: host, username: id, password: pwd, port: port}, 
		function(err) {
			if (err) {
				res.json({"code": "failed", "reason": "camera connection failed"});
				return;
			}
			this.continuousMove({
				x: param.pan,
				y: param.tilt,
				zoom: param.zoom});

			res.json({"code": "success"});
		});
});

app.post("/PTZ/Stop", (req, res) => {
	const { host, port, id, pwd } = req.body;

	new Cam({hostname: host, username: id, password: pwd, port: port},
		function(err) {
			if (err) {
				res.json({"code": "failed", "reason": "camera connection failed"});
				return;
			}
			this.stop({});
			res.json({"code": "success"});
		});
});

app.post("/PTZ/GotoHomePosition", (req, res) => {
        const { host, port, id, pwd } = req.body;

        new Cam({hostname: host, username: id, password: pwd, port: port},
                function(err) {
                        if (err) {
				console.log(err);
                                res.json({"code": "failed", "reason": "camera connection failed"});
                                return;
                        }
                        this.gotoPreset({preset: 1},
					function(error, stream, xml) {
						if(error) {
							res.json({"code": "failed", "reason": "GotoHomePosition failed"});
							return;
						}
                        			res.json({"code": "success"});
					});
                });
});

app.post("/PTZ/SetHomePosition", (req, res) => {
        const { host, port, id, pwd } = req.body;

        new Cam({hostname: host, username: id, password: pwd, port: port},
                function(err) {
                        if (err) {
				console.log(err);
                                res.json({"code": "failed", "reason": "camera connection failed"});
                                return;
                        }
                        this.setPreset({presetName : "1"},
					function(error, stream, xml) {
						if(error) {
                                                        res.json({"code": "failed", "reason": "SetHomePosition failed"});
                                                        return;
                                                }
                        			res.json({"code": "success"});
					});
                });

});

app.post('/Camera/Add', (req, res) => {
    const { name, url, description, pin } = req.body;

    let client = new Client({
        url: 'ws://127.0.0.1:8188'
    });
    createCamera(client, name, url, description, pin)
        .then((value) => {
            res.json(value);
            client.disconnect();
        });

    client.connect();
});

app.post('/Camera/Remove', (req, res) => {
    const { id } = req.body;

    let client = new Client({
        url: 'ws://127.0.0.1:8188'
    });
	console.log("Camera/Remove");
    destroyCamera(client, id)
        .then((value) => {
            res.json({"code": value});
            client.disconnect();
        });

    client.connect();
});

app.post('/Camera/Info', (req, res) => {
    const { id } = req.body;

    let client = new Client({
        url: 'ws://127.0.0.1:8188'
    });
    getCamera(client, id)
        .then((value) => {
            res.json(value);
            client.disconnect();
        });

    client.connect();
});

app.get('/Camera/List', (req, res) => {

    let client = new Client({
        url: 'ws://127.0.0.1:8188'
    });
    listCamera(client)
        .then((value) => {
            res.json({"code": "success", "camera": value});
            client.disconnect();
        });

    client.connect();
});



app.listen(3030, () => console.log("cctv media bridge server"));
