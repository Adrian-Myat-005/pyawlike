const https = require('https');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Initialize DB connection in READ-ONLY mode
const dbPath = path.resolve(__dirname, 'dictionary.db');
let db;

function getDB() {
    if (!db) {
        try {
            db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY);
        } catch (e) {
            console.error("DB Connection Error:", e);
            return null;
        }
    }
    return db;
}

async function queryDB(word) {
    return new Promise((resolve) => {
        const d = getDB();
        if (!d) return resolve([]);
        
        const sql = "SELECT * FROM entries WHERE word = ? COLLATE NOCASE";
        d.all(sql, [word], (err, rows) => {
            if (err) {
                console.error("DB Query Error:", err);
                return resolve([]);
            }
            resolve(rows || []);
        });
    });
}

async function queryFeed(offset = 0) {
    return new Promise((resolve) => {
        const d = getDB();
        if (!d) return resolve([]);

        const sql = "SELECT DISTINCT word, translation FROM entries WHERE translation IS NOT NULL ORDER BY rowid DESC LIMIT 50 OFFSET ?";
        d.all(sql, [offset], (err, rows) => {
            if (err) {
                console.error("Feed Query Error:", err);
                return resolve([]);
            }
            resolve(rows || []);
        });
    });
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
                const defs = await Promise.all((m[2] || []).map(async (d) => {
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
        const synUrl = `https://api.datamuse.com/words?rel_syn=${encodeURIComponent(word)}&max=100`;
        const antUrl = `https://api.datamuse.com/words?rel_ant=${encodeURIComponent(word)}&max=100`;
        const extraExUrl = `https://api.datamuse.com/words?rel_trg=${encodeURIComponent(word)}&max=50`;
        
        const [syns, ants, related] = await Promise.all([
            fetchJSON(synUrl).catch(() => []),
            fetchJSON(antUrl).catch(() => []),
            fetchJSON(extraExUrl).catch(() => [])
        ]);
        
        return {
            synonyms: syns.map(w => w.word),
            antonyms: ants.map(w => w.word),
            related: related.map(w => w.word)
        };
    } catch (e) { return { synonyms: [], antonyms: [], related: [] }; }
}

async function fetchFreeDictData(word) {
    try {
        const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`;
        const data = await fetchJSON(url);
        let examples = [];
        let synonyms = [];
        let antonyms = [];
        if (Array.isArray(data)) {
            data.forEach(entry => {
                (entry.meanings || []).forEach(m => {
                    if (m.synonyms) synonyms.push(...m.synonyms);
                    if (m.antonyms) antonyms.push(...m.antonyms);
                    (m.definitions || []).forEach(d => {
                        if (d.example) examples.push(d.example);
                        if (d.synonyms) synonyms.push(...d.synonyms);
                        if (d.antonyms) antonyms.push(...d.antonyms);
                    });
                });
            });
        }
        return { examples, synonyms, antonyms };
    } catch (e) { return { examples: [], synonyms: [], antonyms: [] }; }
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
        const [google, datamuse, freeDict] = await Promise.all([
            fetchGoogleData(word, isMM ? 'my' : 'en', isMM ? 'en' : 'my'),
            isMM ? Promise.resolve({synonyms:[], antonyms:[], related:[]}) : fetchDatamuseData(word),
            isMM ? Promise.resolve({examples:[], synonyms:[], antonyms:[]}) : fetchFreeDictData(word)
        ]);

        // Merge DB data with Fresh API data
        const combinedMeanings = [...google.meanings];
        if (dbRows.length > 0) {
            dbRows.forEach(row => {
                if (row.definition && !combinedMeanings.some(m => m.definitions.some(d => d.en === row.definition))) {
                    combinedMeanings.push({ 
                        partOfSpeech: row.wordtype || "other", 
                        definitions: [{ en: row.definition, mm: "" }] 
                    });
                }
            });
        }

        // Prepare Examples (Aggressively targeting 5+)
        let finalExamples = [...google.examples, ...freeDict.examples];
        if (dbRows.length > 0 && dbRows[0].examples) {
            try {
                const dbEx = JSON.parse(dbRows[0].examples);
                finalExamples.push(...dbEx);
            } catch(e) {}
        }
        
        // Deduplicate and filter short/bad examples
        finalExamples = [...new Set(finalExamples)]
            .filter(ex => ex && ex.length > 10 && ex.toLowerCase().includes(word.toLowerCase().substring(0, 3)));

        // Prepare Synonyms & Antonyms (Plenty in connection)
        const finalSynonyms = [...new Set([...google.synonyms, ...datamuse.synonyms, ...freeDict.synonyms])].filter(s => s && typeof s === 'string' && s.toLowerCase() !== word.toLowerCase());
        const finalAntonyms = [...new Set([...datamuse.antonyms, ...freeDict.antonyms])].filter(a => a && typeof a === 'string' && a.toLowerCase() !== word.toLowerCase());

        let acronyms = [];
        if (dbRows[0] && dbRows[0].antonyms) {
            try {
                acronyms = JSON.parse(dbRows[0].antonyms);
            } catch(e) {
                console.warn("Failed to parse acronyms from DB");
            }
        }

        res.status(200).json({
            original: word,
            translated: google.translation || (dbRows[0] ? dbRows[0].translation : ""),
            meanings: combinedMeanings,
            examples: finalExamples,
            synonyms: finalSynonyms,
            antonyms: finalAntonyms,
            acronyms: acronyms
        });
    } catch (e) { 
        console.error("Lookup Error:", e);
        res.status(200).json({ 
            error: "Search failed, please try again.",
            original: word,
            translated: "Error",
            meanings: [],
            examples: [],
            synonyms: [],
            antonyms: [],
            acronyms: []
        }); 
    }
};
