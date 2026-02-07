# PyawLike - Minimal AI Translator

A minimalist, tactile speech-to-speech translator powered by Gemini AI, Edge Neural TTS, and Google Translate. Supports bi-directional Burmese (MM) and English (ENG) translation with natural AI enhancement.

## Local Development

1.  Clone this repository.
2.  Open `config.js` and add your **Gemini API Key** from [Google AI Studio](https://aistudio.google.com/).
3.  Open `index.html` in any modern web browser (Chrome/Edge recommended for best Speech Recognition).

## Deployment (Vercel)

1.  **GitHub:** Push your code to a GitHub repository. **Note:** `.gitignore` is configured to exclude `config.js` to keep your API key private.
2.  **Vercel:** 
    *   Import your repository to Vercel.
    *   Since this is a static site, you can either:
        *   Manually create a `config.js` in the Vercel file system (not recommended).
        *   **Recommended:** The app is currently configured to look for `window.ENV.GEMINI_API_KEY`. For a production deployment, you should set up a build step (like Vite or Webpack) or use a Serverless function to proxy requests and hide your key. 

## Features
- **Tactile UI:** Realistic "pancake" split button for language selection.
- **AI Brain:** Gemini 2.0 Flash for language detection and natural translation.
- **Premium TTS:** Microsoft Edge Neural voices for high-quality speech.
- **Zero Latency:** Parallel synthesis for gapless language blending.
- **Minimalist:** No glass boxes, no clutter—just you and the translation.
