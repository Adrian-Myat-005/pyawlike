const https = require('https');
const Database = require('better-sqlite3');
const path = require('path');

// Initialize DB connection in READ-ONLY mode
const dbPath = path.resolve(__dirname, 'dictionary.db');
let db;

function getDB() {
    if (!db) {
        db = new Database(dbPath, { readonly: true, fileMustExist: false });
    }
    return db;
}

async function queryDB(word) {
    try {
        const d = getDB();
        const stmt = d.prepare("SELECT * FROM entries WHERE word = ? COLLATE NOCASE");
        return stmt.all(word);
    } catch (e) {
        console.error("DB Query Error:", e);
        return [];
    }
}

async function queryFeed(offset = 0) {
    try {
        const d = getDB();
        const sql = "SELECT DISTINCT word, translation FROM entries WHERE translation IS NOT NULL ORDER BY rowid DESC LIMIT 50 OFFSET ?";
        const stmt = d.prepare(sql);
        return stmt.all(offset);
    } catch (e) {
        console.error("Feed Query Error:", e);
        return [];
    }
}

async function updateDB(word, translation, examples, synonyms, antonyms, acronyms) {
    // Vercel filesystem is read-only. We cannot update the DB.
    // In a real production app, you'd use an external DB like Supabase or Upstash.
    return 0;
}

async function fetchJSON(url) {
    return new Promise((resolve, reject) => {
        const options = { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 5000 };
        https.get(url, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => { try { resolve(JSON.parse(data)); } catch (e) { reject(e); } });
        }).on('error', reject);
    });
}

async function translateText(text, sl, tl) {
    if (!text || sl === tl) return text;
    try {
        // Using a more structured request for better translation quality
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t&q=${encodeURIComponent(text)}`;
        const data = await fetchJSON(url);
        if (data && data[0]) {
            return data[0].map(s => s[0]).join('').trim();
        }
        return text;
    } catch (e) { 
        console.error("Translation Error:", e);
        return text; 
    }
}

async function fetchGoogleData(word, sl, tl) {
    try {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t&dt=bd&dt=ex&dt=ss&dt=md&q=${encodeURIComponent(word)}`;
        const data = await fetchJSON(url);
        const translation = data[0] ? data[0].map(s => s[0]).join('').trim() : "";
        
        let meanings = [];
        if (data[1] && Array.isArray(data[1])) {
            meanings = await Promise.all(data[1].map(async (m) => {
                const partOfSpeech = m[0];
                const defs = await Promise.all((m[2] || []).slice(0, 3).map(async (d) => {
                    const enDef = d[0];
                    // IMPORTANT: Ensure we always get a valid translation for the block
                    let mmDef = "";
                    if (sl === 'en' && tl === 'my') {
                        mmDef = await translateText(enDef, 'en', 'my');
                    } else if (sl === 'my' && tl === 'en') {
                        mmDef = await translateText(enDef, 'my', 'en');
                    } else {
                        mmDef = enDef;
                    }
                    return { en: enDef, mm: mmDef || "No translation available" };
                }));
                return { partOfSpeech, definitions: defs };
            }));
        }

        let examples = [];
        if (data[13] && Array.isArray(data[13])) {
            let rawList = data[13][0] || [];
            examples = rawList.map(item => (Array.isArray(item) && typeof item[0] === 'string') ? item[0].replace(/<\/?b>/g, '') : null).filter(e => e);
        }
        
        let synonyms = [];
        if (data[11] && Array.isArray(data[11])) {
            data[11].forEach(group => { if (group[1]) synonyms.push(...group[1].map(s => s[0])); });
        }
        
        return { translation, meanings, examples, synonyms: [...new Set(synonyms)] };
    } catch (e) { return { translation: "", meanings: [], examples: [], synonyms: [] }; }
}

async function fetchDatamuseData(word) {
    try {
        // Fetch extra synonyms and examples (usage hints)
        const synUrl = `https://api.datamuse.com/words?rel_syn=${encodeURIComponent(word)}&max=20`;
        const extraExUrl = `https://api.datamuse.com/words?rel_trg=${encodeURIComponent(word)}&max=10`;
        
        const [syns, related] = await Promise.all([
            fetchJSON(synUrl).catch(() => []),
            fetchJSON(extraExUrl).catch(() => [])
        ]);
        
        return {
            synonyms: syns.map(w => w.word),
            related: related.map(w => w.word)
        };
    } catch (e) { return { synonyms: [], related: [] }; }
}

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const word = (req.query.word || (req.body && req.body.word) || "").trim();
    const type = req.query.type;
    const offset = parseInt(req.query.offset) || 0;

    if (type === 'feed') {
        try {
            const words = await queryFeed(offset);
            return res.status(200).json({ words });
        } catch (e) { return res.status(500).json({ error: e.message }); }
    }

    if (!word) return res.status(400).json({ error: "Word is required" });

    try {
        const dbRows = await queryDB(word);
        const isMM = /[\u1000-\u109F]/.test(word);
        
        // Fetch from external APIs aggressively
        const [google, datamuse] = await Promise.all([
            fetchGoogleData(word, isMM ? 'my' : 'en', isMM ? 'en' : 'my'),
            isMM ? Promise.resolve({synonyms:[], related:[]}) : fetchDatamuseData(word)
        ]);

        // Merge DB data with Fresh API data
        const combinedMeanings = [...google.meanings];
        if (dbRows.length > 0) {
            dbRows.forEach(row => {
                if (row.definition && !combinedMeanings.some(m => m.definitions.some(d => d.en === row.definition))) {
                    combinedMeanings.push({ 
                        partOfSpeech: row.wordtype || "other", 
                        definitions: [{ en: row.definition, mm: "Definition from database" }] 
                    });
                }
            });
        }

        // Prepare Examples (Targeting 5)
        let finalExamples = [...google.examples];
        if (dbRows.length > 0 && dbRows[0].examples) {
            try {
                const dbEx = JSON.parse(dbRows[0].examples);
                finalExamples.push(...dbEx);
            } catch(e) {}
        }
        finalExamples = [...new Set(finalExamples)].filter(ex => ex.length > 10).slice(0, 5);

        // If we still need more examples for common English words, we can't easily generate them, 
        // but we ensure the ones we have are high quality.

        const finalSynonyms = [...new Set([...google.synonyms, ...datamuse.synonyms])];

        res.status(200).json({
            original: word,
            translated: google.translation || (dbRows[0] ? dbRows[0].translation : ""),
            meanings: combinedMeanings,
            examples: finalExamples,
            synonyms: finalSynonyms,
            antonyms: dbRows[0] ? JSON.parse(dbRows[0].antonyms || '[]') : [],
            acronyms: dbRows[0] ? JSON.parse(dbRows[0].acronyms || '[]') : []
        });
    } catch (e) { 
        console.error("Lookup Error:", e);
        res.status(500).json({ error: "Search failed, please try again." }); 
    }
};
