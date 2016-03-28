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

const NODE_ENV = process.env.NODE_ENV || 'development'
const PORT = process.env.PORT || 8000;
const ROOT_DIR = path.resolve(process.cwd());

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
        if (res.body) {
            res.json(res.body)
            return;
        }

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

    app.listen(PORT, () => 
        console.log(`LISTENING @ http://127.0.0.1:${PORT}`)
    );
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
        if (stat.isDirectory()) {
            let files = fs.promise.readdir(filePath);
            res.body = JSON.stringify(files);
            res.setHeader('Content-Length', res.body.length);
            res.setHeader('Content-Type', 'application/json');
            return;
        }

        res.setHeader('Content-Length', stat.size);
        var contentType = mime.contentType(path.extname(filePath));
        res.setHeader('Content-Type', contentType);
    }

    let promise = setHeaders();
    promise.then(next);
}

module.exports = main