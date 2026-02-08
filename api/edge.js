const { WebSocket } = require('ws');
const { v4: uuidv4 } = require('uuid');

module.exports = async (req, res) => {
    // Enable CORS for everyone
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const { text, voice } = req.body;
    
    // Wrap in Promise to prevent Vercel from killing the function early
    return new Promise((resolve) => {
        try {
            const ws = new WebSocket("wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=6A5AA1D4EAFF4E9FB37E23D68491D6F4", {
                origin: 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0"
                }
            });

            const audioChunks = [];

            ws.on('open', () => {
                const requestId = uuidv4().replace(/-/g, '');
                ws.send(`X-Timestamp:${new Date().toString()}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n` +
                    JSON.stringify({context:{synthesis:{audio:{metadataoptions:{sentenceBoundaryEnabled:"false",wordBoundaryEnabled:"false"},outputFormat:"audio-24khz-48kbitrate-mono-mp3"}}}}));
                ws.send(`X-RequestId:${requestId}\r\nContent-Type:application/ssml+xml\r\nPath:ssml\r\n\r\n` +
                    `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'><voice name='${voice}'>${text}</voice></speak>`);
            });

            ws.on('message', (data, isBinary) => {
                if (isBinary) audioChunks.push(data);
                else if (data.toString().includes("Path:turn.end")) ws.close();
            });

            ws.on('close', () => {
                const finalBuffer = Buffer.concat(audioChunks);
                res.setHeader('Content-Type', 'audio/mp3');
                res.send(finalBuffer);
                resolve();
            });

            ws.on('error', (err) => {
                console.error("Edge Logic Error:", err);
                res.status(500).json({ error: "Upstream Error" });
                resolve();
            });

        } catch (e) {
            res.status(500).json({ error: "Server Internal Error" });
            resolve();
        }
    });
};