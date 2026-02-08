export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const { text, lang } = req.body;
    // Vercel will look for this Key in its Settings
    const apiKey = process.env.GEMINI_API_KEY; 

    if (!apiKey) return res.status(500).json({ error: "Server missing API Key" });

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                contents: [{ parts: [{ text: `Speak naturally in ${lang==='my'?'Burmese':'English'}: ${text}` }] }],
                generationConfig: { responseMimeType: "audio/wav" } 
            })
        });

        const data = await response.json();
        const audioData = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!audioData) throw new Error("No audio returned");

        res.status(200).json({ audio: audioData });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}