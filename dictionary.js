(function() {
    const dicPopup = document.getElementById('dic-popup');
    const speakerWrapper = document.getElementById('speakerWrapper');
    const closeDic = document.getElementById('closeDic');
    const dicBackBtn = document.getElementById('dicBackBtn');
    const dicOriginal = document.getElementById('dicOriginal');
    const dicTranslated = document.getElementById('dicTranslated');
    const dicExamples = document.getElementById('dicExamples');
    const dicSynonyms = document.getElementById('dicSynonyms');
    const dicAntonyms = document.getElementById('dicAntonyms');
    const dicAcronyms = document.getElementById('dicAcronyms');
    const kbInputContainer = document.getElementById('kbInputContainer');
    const kbInput = document.getElementById('kb-input');
    const kbSuggestions = document.getElementById('kb-suggestions');
    const searchLoader = document.getElementById('searchLoader');
    const dicHomeScreen = document.getElementById('dic-home-screen');
    const dicRecentWords = document.getElementById('dicRecentWords');
    const dicWordSection = document.getElementById('dicWordSection');
    const searchLangBtn = document.getElementById('searchLangBtn');
    const searchMicBtn = document.getElementById('searchMicBtn');
    const customKeyboard = document.getElementById('custom-keyboard');
    const kbCircle = document.getElementById('kbCircle');

    const clickSound = new Audio('click_eff.mp3');
    function playClickSound() {
        clickSound.currentTime = 0;
        clickSound.play().catch(e => {});
    }

    let dicHistory = [];
    let kbLanguage = 'ENG'; 

    async function openDictionary(word = "") {
        dicPopup.classList.add('open');
        kbInputContainer.classList.add('visible');
        if (word) searchWord(word); else showHomeScreen();
    }

    async function showHomeScreen() {
        dicWordSection.style.display = 'none';
        dicHomeScreen.style.display = 'block';
        dicBackBtn.style.visibility = 'hidden';
        try {
            const res = await fetch('/api/lookup?type=feed');
            if (res.ok) {
                const data = await res.json();
                renderFeed(data.words);
            }
        } catch (e) {}
    }

    function renderFeed(words) {
        if (!words || words.length === 0) {
            dicRecentWords.innerHTML = "<div style='opacity:0.5; font-size:12px; text-align:center;'>Feed is empty. Start searching!</div>";
            return;
        }
        dicRecentWords.innerHTML = words.map(w => `
            <div class="word-card" onclick="window.dictionarySearch('${w.word.replace(/'/g, "\\'")}')">
                <div class="card-top">
                    <div class="card-word">${w.word}</div>
                    <div class="card-trans">${w.translation}</div>
                </div>
            </div>
        `).join('');
    }

    window.dictionarySearch = (word) => {
        // CLOSE OVERLAPS
        customKeyboard.classList.remove('open');
        kbSuggestions.classList.remove('visible');
        searchWord(word);
    };
    
    async function searchWord(word, saveToHist = true) {
        if (!word) return;
        if (saveToHist && dicHistory[dicHistory.length - 1] !== word) dicHistory.push(word);
        
        // DISMISS OVERLAPS
        customKeyboard.classList.remove('open');
        kbSuggestions.classList.remove('visible');

        searchLoader.classList.add('visible');
        dicPopup.classList.add('loading');
        dicHomeScreen.style.display = 'none';
        dicWordSection.style.display = 'block';
        updateBackBtn();
        
        try {
            const res = await fetch(`/api/lookup?word=${encodeURIComponent(word)}`);
            if (res.ok) {
                const data = await res.json();
                dicOriginal.innerText = data.original;
                dicTranslated.innerText = data.translated;
                
                // --- AUTO PLAY VOICE ---
                window.playText(data.original);
                setTimeout(() => window.playText(data.translated), 1200);

                dicExamples.innerHTML = (data.examples || []).map(ex => `
                    <div class="example-row">
                        <div class="example-text">${ex}</div>
                        <div class="audio-btn mini" onclick="window.playText(\`${ex.replace(/'/g, "\\'").replace(/"/g, '&quot;')}\`)">
                            <svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
                        </div>
                    </div>`).join('');
                const rend = (l, t) => { if (l && l.length > 0) { t.parentElement.style.display = 'block'; t.innerHTML = l.slice(0, 8).map(w => `<div class="relation-word" onclick="window.dictionarySearch('${w.replace(/'/g, "\\'")}')">${w}</div>`).join(''); } else { t.parentElement.style.display = 'none'; } };
                rend(data.synonyms, dicSynonyms); rend(data.antonyms, dicAntonyms); rend(data.acronyms, dicAcronyms);
            }
        } catch (e) {} finally { 
            dicPopup.classList.remove('loading'); 
            searchLoader.classList.remove('visible'); 
        }
    }

    window.playText = (text) => {
        const isMM = /[\u1000-\u109F]/.test(text);
        const lang = isMM ? 'my' : 'en';
        const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${lang}&client=tw-ob`;
        new Audio(url).play().catch(e => {
            console.error("Direct TTS failed, trying proxy...");
            fetch(`/api/edge`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, voice: isMM ? 'my-MM-NilarNeural' : 'en-US-AvaNeural' }) })
                .then(res => res.blob()).then(blob => new Audio(URL.createObjectURL(blob)).play());
        });
    };

    searchLangBtn.addEventListener('click', () => { kbLanguage = kbLanguage === 'ENG' ? 'MM' : 'ENG'; searchLangBtn.innerText = kbLanguage; kbInput.placeholder = kbLanguage === 'ENG' ? 'Type word...' : 'စာရိုက်ပါ...'; });
    
    searchMicBtn.addEventListener('click', () => {
        playClickSound();
        startVoiceSearch();
    });

    function startVoiceSearch() {
        const Speech = window.webkitSpeechRecognition || window.speechRecognition;
        if (!Speech) return;
        const rec = new Speech();
        rec.lang = kbLanguage === 'ENG' ? 'en-US' : 'my-MM';
        rec.onstart = () => { 
            searchMicBtn.classList.add('recording'); 
            kbInput.placeholder = kbLanguage === 'ENG' ? "Listening..." : "နားထောင်နေသည်...";
        };
        rec.onresult = (ev) => searchWord(ev.results[0][0].transcript);
        rec.onend = () => { searchMicBtn.classList.remove('recording'); kbInput.placeholder = kbLanguage === 'ENG' ? "Type word..." : "စာရိုက်ပါ..."; };
        rec.start();
    }

    closeDic.addEventListener('click', () => { dicPopup.classList.remove('open'); customKeyboard.classList.remove('open'); kbInputContainer.classList.remove('visible'); });
    dicBackBtn.addEventListener('click', () => { if (dicHistory.length > 1) { dicHistory.pop(); searchWord(dicHistory.pop(), true); } else { showHomeScreen(); } });
    function updateBackBtn() { dicBackBtn.style.visibility = dicHistory.length > 1 ? 'visible' : 'hidden'; }

    // TRIPLE TAP TO OPEN
    let lastTap = 0;
    let tapCount = 0;
    const handleTapGesture = (e) => {
        if (e.target !== document.body || dicPopup.classList.contains('open')) return;
        const now = Date.now();
        if (now - lastTap < 400) {
            tapCount++;
            if (tapCount === 3) {
                tapCount = 0;
                openDictionary();
            }
        } else {
            tapCount = 1;
        }
        lastTap = now;
    };
    document.addEventListener('touchstart', handleTapGesture, { passive: true });
    document.addEventListener('mousedown', (e) => { if (e.button === 0) handleTapGesture(e); });

    // Keyboard Logic
    const mmRows = ["ကခဂဃငစဆဇဈဉ".split(""), "ညဋဌဍဎဏတထဒဓ".split(""), "နပဖဗဘမယရ".split(""), "လဝသဟဠအ".split("")];
    const enRows = ["qwertyuiop".split(""), "asdfghjkl".split(""), "zxcvbnm".split("")];

    function generateKeys() {
        kbCircle.innerHTML = "";
        const rows = kbLanguage === 'ENG' ? enRows : mmRows;
        const centerX = 225, centerY = 225;
        const config = [{ r: 210, a: 2.2, s: 40 }, { r: 170, a: 2.0, s: 38 }, { r: 130, a: 1.8, s: 34 }, { r: 92, a: 1.6, s: 30 }];

        rows.forEach((row, ri) => {
            const { r, a, s } = config[ri] || config[0];
            row.forEach((key, ki) => {
                const angle = (0.95 * Math.PI) + (ki / (row.length - 1)) * a;
                const btn = document.createElement('div');
                btn.className = 'kb-key'; btn.innerText = key;
                btn.style.left = `${centerX + r * Math.cos(angle) - s/2}px`;
                btn.style.top = `${centerY + r * Math.sin(angle) - s/2}px`;
                btn.style.width = btn.style.height = `${s}px`;
                btn.addEventListener('click', (e) => { e.stopPropagation(); kbInput.value += key; kbInput.dispatchEvent(new Event('input')); });
                kbCircle.appendChild(btn);
            });
        });

        const ctrl = (x, y, txt, bg, act) => {
            const b = document.createElement('div'); b.className = 'kb-key'; b.innerText = txt;
            b.style.left = `${x}px`; b.style.top = `${y}px`; b.style.background = bg; b.style.color = 'white';
            b.addEventListener('click', (e) => { e.stopPropagation(); act(); }); kbCircle.appendChild(b);
        };
        ctrl(-45, 180, kbLanguage === 'ENG' ? 'MM' : 'EN', 'var(--accent)', () => { kbLanguage = kbLanguage==='ENG'?'MM':'ENG'; generateKeys(); });
        ctrl(centerX - 35, centerY - 35, '🔍', 'var(--success)', () => { searchWord(kbInput.value); });
        ctrl(centerX + 65, centerY - 65, '⌫', 'var(--error)', () => { kbInput.value = kbInput.value.slice(0,-1); kbInput.dispatchEvent(new Event('input')); });
    }

    kbInput.addEventListener('click', () => {
        customKeyboard.classList.add('open');
        generateKeys();
    });

    kbInput.addEventListener('input', async () => {
        if (kbInput.value.trim()) {
            const r = await fetch(`https://api.datamuse.com/words?sp=${kbInput.value}*&max=5`);
            const d = await r.json();
            kbSuggestions.innerHTML = d.map(i => `<div class="suggestion-item" onclick="window.dictionarySearch('${i.word.replace(/'/g, "\\'")}'); document.getElementById('kb-input').value='';">${i.word}</div>`).join('');
            kbSuggestions.classList.add('visible');
        } else kbSuggestions.classList.remove('visible');
    });

})();
