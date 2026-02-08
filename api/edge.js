const { WebSocket } = require('ws');
const { v4: uuidv4 } = require('uuid');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const { text, voice } = req.body;
    let isDone = false; // CRASH GUARD

    return new Promise((resolve) => {
        try {
            // 1. CONNECT (Updated Headers to bypass 403)
            const ws = new WebSocket("wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=6A5AA1D4EAFF4E9FB37E23D68491D6F4", {
                headers: {
                    "Pragma": "no-cache",
                    "Cache-Control": "no-cache",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0",
                    "Origin": "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold",
                    "Accept-Encoding": "gzip, deflate, br",
                    "Accept-Language": "en-US,en;q=0.9"
                }
            });

            const audioChunks = [];

            ws.on('open', () => {
                const requestId = uuidv4().replace(/-/g, '');
                // 2. SEND CONFIG (Standard Protocol)
                ws.send(`X-Timestamp:${new Date().toString()}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n` +
                    JSON.stringify({context:{synthesis:{audio:{metadataoptions:{sentenceBoundaryEnabled:"false",wordBoundaryEnabled:"false"},outputFormat:"audio-24khz-48kbitrate-mono-mp3"}}}}));
                // 3. SEND TEXT
                ws.send(`X-RequestId:${requestId}\r\nContent-Type:application/ssml+xml\r\nPath:ssml\r\n\r\n` +
                    `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'><voice name='${voice}'>${text}</voice></speak>`);
            });

            ws.on('message', (data, isBinary) => {
                if (isBinary) {
                    audioChunks.push(data);
                } else {
                    const str = data.toString();
                    if (str.includes("Path:turn.end")) {
                        ws.close();
                    }
                }
            });

            ws.on('close', () => {
                if (isDone) return;
                isDone = true;
                
                if (audioChunks.length > 0) {
                    const finalBuffer = Buffer.concat(audioChunks);
                    res.setHeader('Content-Type', 'audio/mp3');
                    res.send(finalBuffer);
                } else {
                    // If closed with no audio, it was a block
                    console.error("Microsoft closed connection with no audio (Likely 403 Block)");
                    res.status(503).json({ error: "Voice Service Blocked" });
                }
                resolve();
            });

            ws.on('error', (err) => {
                if (isDone) return;
                isDone = true;
                console.error("Edge Logic Error:", err.message);
                res.status(500).json({ error: "Voice Connection Failed" });
                resolve();
            });

        } catch (e) {
            if (!isDone) {
                isDone = true;
                res.status(500).json({ error: "Server Internal Error" });
                resolve();
            }
        }
    });
};