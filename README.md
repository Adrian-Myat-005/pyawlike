# PyawLike - Minimal AI Translator

A minimalist, tactile speech-to-speech translator powered by Gemini AI, Edge Neural TTS, and Google Translate. Supports bi-directional Burmese (MM) and English (ENG) translation with natural AI enhancement.

## Local Development

1.  Clone this repository.
2.  Open `config.js` and add your **Gemini API Key** from [Google AI Studio](https://aistudio.google.com/).
3.  Open `index.html` in any modern web browser (Chrome/Edge recommended for best Speech Recognition).

## Deployment (Vercel)

1.  **GitHub:** Push your code to your GitHub repository.
2.  **Vercel Dashboard:**
    *   Import your repository.
    *   Go to **Settings** > **Environment Variables**.
    *   Add a new variable:
        *   **Key:** `GEMINI_API_KEY`
        *   **Value:** `YOUR_ACTUAL_GEMINI_API_KEY`
3.  **Build Settings:**
    *   Vercel will detect the `package.json` and automatically run the `npm run build` command.
    *   This script creates the `config.js` file dynamically using your Environment Variable during deployment.
4.  **Deploy:** Your app will now be live and using your API key securely from Vercel!

## Features
- **Tactile UI:** Realistic "pancake" split button for language selection.
- **AI Brain:** Gemini 2.0 Flash for language detection and natural translation.
- **Premium TTS:** Microsoft Edge Neural voices for high-quality speech.
- **Zero Latency:** Parallel synthesis for gapless language blending.
- **Minimalist:** No glass boxes, no clutter—just you and the translation.