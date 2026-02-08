const { WebSocket } = require('ws');
const { v4: uuidv4 } = require('uuid');

module.exports = async (req, res) => {
    // 1. CORS HEADERS (Allow your App to talk to this Server)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const { text, voice } = req.body;
    if (!text) return res.status(400).json({ error: "No text provided" });

    // 2. CONNECT TO MICROSOFT (Server-to-Server)
    const ws = new WebSocket("wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=6A5AA1D4EAFF4E9FB37E23D68491D6F4", {
        origin: 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold', // Pretend to be the Edge Extension
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0"
        }
    });

    const audioChunks = [];

    ws.on('open', () => {
        const requestId = uuidv4().replace(/-/g, '');
        // Config Message
        ws.send(`X-Timestamp:${new Date().toString()}
Content-Type:application/json; charset=utf-8
Path:speech.config

` +
            JSON.stringify({context:{synthesis:{audio:{metadataoptions:{sentenceBoundaryEnabled:"false",wordBoundaryEnabled:"false"},outputFormat:"audio-24khz-48kbitrate-mono-mp3"}}}}));
        // Text Message
        ws.send(`X-RequestId:${requestId}
Content-Type:application/ssml+xml
Path:ssml

` +
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
        // 3. SEND AUDIO BACK TO APP
        const finalBuffer = Buffer.concat(audioChunks);
        res.setHeader('Content-Type', 'audio/mp3');
        res.send(finalBuffer);
    });

    ws.on('error', (err) => {
        console.error("Edge TTS Error:", err);
        res.status(500).json({ error: "Edge TTS failed" });
    });
};