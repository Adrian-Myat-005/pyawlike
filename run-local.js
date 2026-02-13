const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const dictionaryHandler = require('./api/lookup.js');

const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;

    // 1. Handle API calls (This is where the Lazy Loading happens!)
    if (pathname === '/api/lookup') {
        const mockReq = { method: req.method, query: parsedUrl.query, headers: req.headers };
        const mockRes = {
            status: (code) => { res.statusCode = code; return mockRes; },
            json: (data) => {
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(data));
            },
            setHeader: (name, value) => { res.setHeader(name, value); },
            end: (data) => { res.end(data); }
        };
        dictionaryHandler(mockReq, mockRes).catch(err => {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
        });
        return;
    }

    // 2. Serve static files (HTML, JS, CSS)
    let filePath = '.' + pathname;
    if (filePath === './' || filePath === '.') filePath = './index.html';

    const extname = String(path.extname(filePath)).toLowerCase();
    const mimeTypes = {
        '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
        '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpg', '.svg': 'image/svg+xml'
    };

    const contentType = mimeTypes[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            res.writeHead(404);
            res.end('File not found');
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`
=========================================`);
    console.log(`LOCAL TEST SERVER: http://localhost:${PORT}`);
    console.log(`Search words to see Lazy Loading in action!`);
    console.log(`=========================================
`);
});
