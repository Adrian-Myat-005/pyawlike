const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, 'api/dictionary.db');
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE);

const commonMM = [
    "မင်္ဂလာပါ", "နေကောင်းလား", "ကျေးဇူးတင်ပါတယ်", "စားပြီးပြီလား", "ဟုတ်ကဲ့", 
    "မဟုတ်ဘူး", "ဘယ်လောက်လဲ", "ဘယ်မှာလဲ", "သွားတော့မယ်", "ချစ်တယ်",
    "အိမ်", "ကျောင်း", "စျေး", "ထမင်း", "ရေ", "ဟင်း", "အသား", "ငါး", "သီးနှံ", "ပန်း",
    "ကား", "ဆိုင်ကယ်", "စက်ဘီး", "လမ်း", "တံတား", "မြို့", "ရွာ", "နိုင်ငံ", "ကမ္ဘာ", "ကောင်းကင်",
    "နေ", "လ", "ကြယ်", "မိုး", "လေ", "မီး", "မြေ", "သစ်ပင်", "တော", "တောင်",
    "လူ", "ယောက်ျား", "မိန်းမ", "ကလေး", "အဖေ", "အမေ", "ညီအစ်ကို", "မောင်နှမ", "သူငယ်ချင်း", "ဆရာ"
];

db.serialize(() => {
    const stmt = db.prepare("INSERT OR IGNORE INTO entries (word, wordtype, definition) VALUES (?, ?, ?)");
    commonMM.forEach(word => {
        stmt.run(word, "common", "Burmese starter word");
    });
    stmt.finalize();
    console.log("Injected " + commonMM.length + " common Burmese words.");
});
db.close();
