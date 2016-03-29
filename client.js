'use strict'
let fs = require('fs')
let path = require('path')
let mkdirp = require('mkdirp')
let rimraf = require('rimraf')
let ROOT_DIR = '/tmp/dropbox-client'
let port = 8900
let request = require('request')
let wrap = require('co-express')
require('songbird')

var net = require('net'),
    JsonSocket = require('json-socket');

let host = '127.0.0.1';
let socket = new JsonSocket(new net.Socket()); //Decorate a standard net.Socket with JsonSocket
socket.connect(port, host);
socket.on('connect', function() { //Don't send until we're connected
    console.log(`LISTENING to http://127.0.0.1:${port}`)
    socket.on('message', wrap(function*(message) {
        let action = message.action,
            path = message.path,
            type = message.type,
            updated = message.updated;

        if (action === 'delete') {
            console.log("Remove" + ROOT_DIR + path)
            if (type === 'dir') {
                yield rimraf.promise(ROOT_DIR + path);
            } else {
                yield fs.promise.unlink(ROOT_DIR + path);
            }

        } else if (action === 'create') {
            if (type === 'dir') {
                console.log("PATH" + ROOT_DIR + path)
                yield mkdirp.promise(ROOT_DIR + path);
            } else {
                let options = {
                    method: "GET",
                    url: 'http://127.0.0.1:8000/' + path,
                    // headers: {'Accept': 'application/x-gtar'}
                }

                yield request(options).pipe(fs.createWriteStream(ROOT_DIR + path));
            }
        } else if (action === 'write') {
            let options = {
                    method: "GET",
                    url: 'http://127.0.0.1:8000/' + path,
                    // headers: {'Accept': 'application/x-gtar'}
            }

            yield request(options).pipe(fs.createWriteStream(ROOT_DIR + path));
        }
    }));

    // socket.on('close', function() {
    //     console.log('Connection closed');
    // });
});
