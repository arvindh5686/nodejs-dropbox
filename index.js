#!/usr/bin/env node

require('./helper')
let fs = require('fs')
let express = require('express')
let morgan = require('morgan')
let trycatch = require('trycatch')
let wrap = require('co-express')
    //let bodyParser = require('body-parser')
let path = require('path')
let bodyParser = require('simple-bodyparser')
let mime = require('mime-types')
    //let nodeify = require('bluebird-nodeify')
let rimraf = require('rimraf')
let mkdirp = require('mkdirp')
let argv = require('yargs').argv
let chokidar = require('chokidar')
let net = require('net'),
    JsonSocket = require('json-socket');
let archiver = require('archiver')

const NODE_ENV = process.env.NODE_ENV || 'development'
const PORT = process.env.PORT || 8000;
const ROOT_DIR = argv.dir || path.resolve(process.cwd());

function main() {
    let app = express();
    if (NODE_ENV === 'development') {
        app.use(morgan('dev'));
    }
    app.use((req, res, next) => {
        trycatch(next, e => {
            console.log(e.stack);
            res.writeHead(500);
            res.end(JSON.stringify(e.stack));
        });
    });

    app.get('*', setFileMeta, sendHeaders, (req, res) => {
        if (!req.stat) {
            res.send(400, 'Invalid path');
            return;
        }

        // handle zip/tar
        var requestType = req.get('Content-Type');
        console.log(requestType)
        if (req.stat.isDirectory() && requestType === 'application/x-gtar') {
            console.log("i am in")
            let archive = archiver('zip')

            async function generateArchive() {
                let output = await fs.createWriteStream(req.filePath + '/target.zip');
                var archive = archiver('zip');

                output.on('close', function () {
                    console.log(archive.pointer() + ' total bytes');
                    console.log('archiver has been finalized and the output file descriptor has closed.');
                });

                archive.on('error', function(err){
                    throw err;
                });

                archive.pipe(output);
                archive.bulk([{
                    expand: true,
                    cwd: req.filePath,
                    src: ["**/*"],
                    dot: true
                }]);
                archive.finalize();
                res.setHeader('Content-Type', 'application/x-gtar');
                let zipFile = await fs.createReadStream(req.filePath + '/target.zip');
                zipFile.pipe(res);
                res.end();
                // console.log("req filepath" + req.filePath)
                
                // archive.finalize();
                // res.setHeader('Content-Type', 'application/x-gtar');
                // archive.pipe(res);
            }

            let promise = generateArchive();
            return;
        }

        //handle directory
        if (res.body) {
            res.json(res.body)
            return;
        }

        //handle files
        fs.createReadStream(req.filePath).pipe(res);
    });

    app.head('*', setFileMeta, sendHeaders, (req, res) => res.end());

    app.delete('*', setFileMeta, (req, res, next) => {
        async function asyncDelete() {
            if (!req.stat) {
                res.send(400, 'Invalid path');
                return;
            }
            if (req.stat.isDirectory()) {
                await rimraf.promise(req.filePath);
            } else {
                await fs.promise.unlink(req.filePath);
            }

            res.end();
        }

        let promise = asyncDelete();
        promise.then(next);
    });

    app.put('*', setFileMeta, setDirInfo, (req, res, next) => {
        async function createDirAndFile() {
            if (req.stat) return res.send(405, 'File exists');

            console.log("DIR: " + req.dirPath);
            await mkdirp.promise(req.dirPath);

            if (!req.isDir) req.pipe(fs.createWriteStream(req.filePath));
            res.end();
        }

        let promise = createDirAndFile();
        promise.then(next);
    });

    app.post('*', setFileMeta, setDirInfo, (req, res, next) => {
        async function updateFile() {
            if (!req.stat) return res.send(405, 'File not exists');
            if (req.isDir) return res.send(405, 'Path is a directory');

            await fs.promise.truncate(req.filePath, 0);
            req.pipe(fs.createWriteStream(req.filePath));
            res.end();
        }

        let promise = updateFile();
        promise.then(next);
    });

    let tcpPort = 8900;
    let server = net.createServer();
    server.listen(tcpPort);
    console.log(`TCP LISTENING @ http://127.0.0.1:8900`)
    let socket;
    server.on('connection', function(conn) { //This is a standard net.Socket
        socket = new JsonSocket(conn); //Now we've decorated the net.Socket to be a JsonSocket
        // One-liner for current directory, ignores .dotfiles 
        let watcher = chokidar.watch(ROOT_DIR, { ignored: /[\/\\]\./ });
        watcher
            .on('add', path => {
                path = path.substring(ROOT_DIR.length);
                let payload = {
                    "action": "create",
                    "path": `${path}`,
                    "type": "file",
                    "updated": Math.floor(Date.now() / 1000)
                }
                socket.sendMessage(payload)
                console.log(`File ${path} has been added`)
            })
            .on('change', path => {
                path = path.substring(ROOT_DIR.length);
                let payload = {
                    "action": "write",
                    "path": `${path}`,
                    "type": "file",
                    "updated": Math.floor(Date.now() / 1000)
                }
                socket.sendMessage(payload)
                console.log(`File ${path} has been added`)
            })
            .on('unlink', path => {
                path = path.substring(ROOT_DIR.length);
                let payload = {
                    "action": "delete",
                    "path": `${path}`,
                    "type": "file",
                    "updated": Math.floor(Date.now() / 1000)
                }
                socket.sendMessage(payload)
                console.log(`File ${path} has been added`)
            })

        // More possible events. 
        watcher
            .on('addDir', path => {
                path = path.substring(ROOT_DIR.length);
                console.log("DIR" + path)
                let payload = {
                    "action": "create",
                    "path": path,
                    "type": "dir",
                    "updated": Math.floor(Date.now() / 1000)
                }
                socket.sendMessage(payload)
                console.log(`File ${path} has been added`)
            })
            .on('unlinkDir', path => {
                path = path.substring(ROOT_DIR.length);
                let payload = {
                    "action": "delete",
                    "path": `${path}`,
                    "type": "dir",
                    "updated": Math.floor(Date.now() / 1000)
                }
                socket.sendMessage(payload)
                console.log(`File ${path} has been added`)
            })
            .on('error', error => console.log(`Watcher error: ${error}`))
            .on('ready', () => console.log('Initial scan complete. Ready for changes'))
            .on('raw', (event, path, details) => {
                console.log('Raw event info:', event, path, details);
            });
    });

    server.on('close', function() {
        console.log('Connection closed');
    });

    app.listen(PORT, () =>
        console.log(`LISTENING @ http://127.0.0.1:${PORT}`)
    );
}

function setDirInfo(req, res, next) {
    let endsWithSlash = req.filePath.charAt(req.filePath.length - 1) === path.sep;
    let hasExt = path.extname(req.filePath) !== '';

    req.isDir = endsWithSlash || !hasExt
    req.dirPath = req.isDir ? req.filePath : path.dirname(req.filePath);
    next();
}

function setFileMeta(req, res, next) {
    req.filePath = path.resolve(path.join(ROOT_DIR, req.url));
    if (req.filePath.indexOf(ROOT_DIR) !== 0) {
        res.send(400, 'Invalid path');
        return;
    }

    fs.promise.stat(req.filePath)
        .then((stat) => {
            req.stat = stat;
        })
        .catch(() => {
            req.stat = null;
        })
        .then(next);
}

function sendHeaders(req, res, next) {
    async function setHeaders() {
        let filePath = req.filePath;

        let stat = req.stat;
        if (!stat) {
            res.send(400, 'Invalid path');
            return;
        } else {
            if (stat.isDirectory()) {
                let files = await fs.promise.readdir(filePath);
                res.body = JSON.stringify(files);
                console.log("files: " + res.body)
                res.setHeader('Content-Length', res.body.length);
                res.setHeader('Content-Type', 'application/json');
                return;
            }

            res.setHeader('Content-Length', stat.size);
            let contentType = mime.contentType(path.extname(filePath));
            res.setHeader('Content-Type', contentType);
        }
    }

    let promise = setHeaders();
    promise.then(next);
}

module.exports = main
