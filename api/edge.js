const { WebSocket } = require('ws');
const { v4: uuidv4 } = require('uuid');
const https = require('https');

// HELPER: Google TTS Fallback (The Safety Net)
function getGoogleTTS(text, edgeVoice) {
    return new Promise((resolve, reject) => {
        // Map Edge Voice IDs to Google Language Codes
        const lang = edgeVoice.includes('my-MM') ? 'my' : 'en';
        const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${lang}&client=tw-ob`;

        https.get(url, (res) => {
            const data = [];
            res.on('data', (chunk) => data.push(chunk));
            res.on('end', () => {
                if (res.statusCode === 200) {
                    console.log(`✅ Served via Google TTS (${lang})`);
                    resolve(Buffer.concat(data));
                } else {
                    reject(new Error(`Google TTS failed: ${res.statusCode}`));
                }
            });
        }).on('error', reject);
    });
}

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const { text, voice } = req.body;
    
    // WRAPPER: Try Edge, Catch Error, Return Google
    try {
        const edgeAudio = await new Promise((resolve, reject) => {
            const ws = new WebSocket("wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=6A5AA1D4EAFF4E9FB37E23D68491D6F4", {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0",
                    "Origin": "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold",
                    "Accept-Encoding": "gzip, deflate, br",
                    "Accept-Language": "en-US,en;q=0.9"
                },
                handshakeTimeout: 5000 // Fail fast if blocked
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
                if (audioChunks.length > 0) resolve(Buffer.concat(audioChunks));
                else reject(new Error("Edge Closed with 0 bytes (Blocked)"));
            });

            ws.on('error', (e) => reject(e));
            ws.on('unexpected-response', () => reject(new Error("403 Forbidden")));
        });

        // SUCCESS: Send Edge Audio
        res.setHeader('Content-Type', 'audio/mp3');
        res.send(edgeAudio);

    } catch (e) {
        // FAILURE: Fallback to Google
        console.warn(`⚠️ Edge Blocked (${e.message}). Switching to Google...`);
        try {
            const googleAudio = await getGoogleTTS(text, voice);
            res.setHeader('Content-Type', 'audio/mp3');
            res.send(googleAudio);
        } catch (googleErr) {
            console.error("❌ Both Services Failed");
            res.status(500).json({ error: "All TTS Systems Failed" });
        }
    }
};