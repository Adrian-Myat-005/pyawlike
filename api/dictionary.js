const https = require('https');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Initialize DB connection
const dbPath = path.resolve(__dirname, 'dictionary.db');
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE);

async function queryDB(word) {
    return new Promise((resolve, reject) => {
        db.all("SELECT * FROM entries WHERE word = ? COLLATE NOCASE", [word], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

async function queryFeed(offset = 0) {
    return new Promise((resolve, reject) => {
        // Fetch words with translations for the blog-style feed
        const sql = "SELECT DISTINCT word, translation FROM entries WHERE translation IS NOT NULL ORDER BY rowid DESC LIMIT 50 OFFSET ?";
        db.all(sql, [offset], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

async function updateDB(word, translation, examples, synonyms, antonyms, acronyms) {
    return new Promise((resolve) => {
        const examplesJson = JSON.stringify(examples);
        const synonymsJson = JSON.stringify(synonyms);
        const antonymsJson = JSON.stringify(antonyms);
        const acronymsJson = JSON.stringify(acronyms);
        const updateSql = `UPDATE entries SET translation = ?, examples = ?, synonyms = ?, antonyms = ?, acronyms = ? WHERE word = ? COLLATE NOCASE`;
        db.run(updateSql, [translation, examplesJson, synonymsJson, antonymsJson, acronymsJson, word], function(err) {
            if (err) return resolve(0);
            if (this.changes === 0) {
                const insertSql = `INSERT INTO entries (word, translation, examples, synonyms, antonyms, acronyms, wordtype, definition) VALUES (?, ?, ?, ?, ?, ?, 'added', 'Learned from user search')`;
                db.run(insertSql, [word, translation, examplesJson, synonymsJson, antonymsJson, acronymsJson], () => resolve(1));
            } else resolve(this.changes);
        });
    });
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

async function fetchGoogleData(word, sl, tl) {
    try {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t&dt=bd&dt=ex&dt=ss&q=${encodeURIComponent(word)}`;
        const data = await fetchJSON(url);
        const translation = data[0] ? data[0].map(s => s[0]).join('').trim() : "";
        let examples = [];
        if (data[13] && Array.isArray(data[13])) {
            let rawList = data[13];
            if (Array.isArray(rawList[0]) && Array.isArray(rawList[0][0])) rawList = rawList[0];
            examples = rawList.map(item => (Array.isArray(item) && typeof item[0] === 'string') ? item[0].replace(/<\/?b>/g, '') : null).filter(e => e);
        }
        
        let synonyms = [], antonyms = [];
        // Extract synonyms from Google response (dt=ss or dt=bd)
        if (data[1] && Array.isArray(data[1])) {
            data[1].forEach(type => {
                if (type[2]) {
                    type[2].forEach(synGroup => {
                        if (synGroup[1]) synonyms.push(...synGroup[1]);
                    });
                }
            });
        }
        
        return { translation, examples, synonyms: [...new Set(synonyms)], antonyms };
    } catch (e) { return { translation: "", examples: [], synonyms: [], antonyms: [] }; }
}

async function fetchDatamuseData(word) {
    try {
        const synUrl = `https://api.datamuse.com/words?rel_syn=${encodeURIComponent(word)}&max=10`;
        const antUrl = `https://api.datamuse.com/words?rel_ant=${encodeURIComponent(word)}&max=10`;
        // Datamuse doesn't have a direct acronym relation, but ml (means like) can sometimes find them
        // or we can look for words that are all caps or short
        const acroUrl = `https://api.datamuse.com/words?ml=${encodeURIComponent(word)}&max=20`;
        
        const [syns, ants, related] = await Promise.all([
            fetchJSON(synUrl),
            fetchJSON(antUrl),
            fetchJSON(acroUrl)
        ]);
        
        const acronyms = related
            .filter(w => w.word.length <= 5 && w.word === w.word.toUpperCase() && w.word !== word.toUpperCase())
            .map(w => w.word);

        return {
            synonyms: syns.map(w => w.word),
            antonyms: ants.map(w => w.word),
            acronyms: acronyms
        };
    } catch (e) { return { synonyms: [], antonyms: [], acronyms: [] }; }
}

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const word = req.query.word || (req.body && req.body.word);
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
        if (dbRows.length > 0 && dbRows[0].translation && dbRows[0].examples && JSON.parse(dbRows[0].examples).length > 0) {
            const row = dbRows[0];
            return res.status(200).json({
                original: word,
                translated: row.translation,
                meanings: dbRows.map(r => ({ partOfSpeech: r.wordtype, definitions: [{ definition: r.definition }] })),
                examples: JSON.parse(row.examples).slice(0, 5),
                synonyms: JSON.parse(row.synonyms || '[]'),
                antonyms: JSON.parse(row.antonyms || '[]'),
                acronyms: JSON.parse(row.acronyms || '[]')
            });
        }

        const isMM = /[\u1000-\u109F]/.test(word);
        const [google, datamuse] = await Promise.all([
            fetchGoogleData(word, isMM ? 'my' : 'en', isMM ? 'en' : 'my'),
            isMM ? Promise.resolve({synonyms:[], antonyms:[], acronyms:[]}) : fetchDatamuseData(word)
        ]);

        const synonyms = [...new Set([...google.synonyms, ...datamuse.synonyms])];
        const antonyms = [...new Set([...google.antonyms, ...datamuse.antonyms])];
        const acronyms = datamuse.acronyms;

        if (google.translation) await updateDB(word, google.translation, google.examples, synonyms, antonyms, acronyms);

        res.status(200).json({
            original: word,
            translated: google.translation,
            meanings: dbRows.map(r => ({ partOfSpeech: r.wordtype, definitions: [{ definition: r.definition }] })),
            examples: google.examples.slice(0, 5),
            synonyms: synonyms,
            antonyms: antonyms,
            acronyms: acronyms
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
};
