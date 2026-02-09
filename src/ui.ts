// Types
interface TextItem {
    id: string;
    characters: string;
    name: string;
}

interface Language {
    code: string;
    name: string;
    flag: string;
}

// Available languages
const LANGUAGES: Language[] = [
    { code: 'es', name: 'Spanish', flag: '🇪🇸' },
    { code: 'fr', name: 'French', flag: '🇫🇷' },
    { code: 'de', name: 'German', flag: '🇩🇪' },
    { code: 'it', name: 'Italian', flag: '🇮🇹' },
    { code: 'pt', name: 'Portuguese', flag: '🇵🇹' },
    { code: 'nl', name: 'Dutch', flag: '🇳🇱' },
    { code: 'pl', name: 'Polish', flag: '🇵🇱' },
    { code: 'ru', name: 'Russian', flag: '🇷🇺' },
    { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
    { code: 'ko', name: 'Korean', flag: '🇰🇷' },
    { code: 'zh', name: 'Chinese', flag: '🇨🇳' },
    { code: 'ar', name: 'Arabic', flag: '🇸🇦' },
    { code: 'tr', name: 'Turkish', flag: '🇹🇷' },
    { code: 'hi', name: 'Hindi', flag: '🇮🇳' },
    { code: 'sv', name: 'Swedish', flag: '🇸🇪' },
    { code: 'no', name: 'Norwegian', flag: '🇳🇴' },
    { code: 'da', name: 'Danish', flag: '🇩🇰' },
    { code: 'fi', name: 'Finnish', flag: '🇫🇮' },
];

// State
let extractedTexts: TextItem[] = [];
let selectedLanguages: Set<string> = new Set();
let apiKey: string = '';

// DOM Elements (initialized after DOM is ready)
let apiKeyInput: HTMLInputElement;
let toggleKeyBtn: HTMLButtonElement;
let contextInput: HTMLTextAreaElement;
let languageGrid: HTMLDivElement;
let previewSection: HTMLElement;
let textPreview: HTMLDivElement;
let textCount: HTMLSpanElement;
let createCopiesCheckbox: HTMLInputElement;
let translateBtn: HTMLButtonElement;
let cancelBtn: HTMLButtonElement;
let statusSection: HTMLElement;
let statusText: HTMLSpanElement;
let progressFill: HTMLDivElement;

// Initialize DOM elements
function initDOMElements() {
    apiKeyInput = document.getElementById('api-key') as HTMLInputElement;
    toggleKeyBtn = document.getElementById('toggle-key') as HTMLButtonElement;
    contextInput = document.getElementById('context') as HTMLTextAreaElement;
    languageGrid = document.getElementById('language-grid') as HTMLDivElement;
    previewSection = document.getElementById('preview-section') as HTMLElement;
    textPreview = document.getElementById('text-preview') as HTMLDivElement;
    textCount = document.getElementById('text-count') as HTMLSpanElement;
    createCopiesCheckbox = document.getElementById('create-copies') as HTMLInputElement;
    translateBtn = document.getElementById('translate-btn') as HTMLButtonElement;
    cancelBtn = document.getElementById('cancel-btn') as HTMLButtonElement;
    statusSection = document.getElementById('status-section') as HTMLElement;
    statusText = document.getElementById('status-text') as HTMLSpanElement;
    progressFill = document.getElementById('progress-fill') as HTMLDivElement;
}

// Initialize
function init() {
    // Initialize DOM elements first
    initDOMElements();

    // Render language grid FIRST (before anything that might fail)
    renderLanguageGrid();

    // Try to load saved settings (may fail in sandbox)
    try {
        const savedKey = localStorage.getItem('openai-api-key');
        if (savedKey) {
            apiKey = savedKey;
            apiKeyInput.value = savedKey;
        }

        const savedContext = localStorage.getItem('translation-context');
        if (savedContext) {
            contextInput.value = savedContext;
        }
    } catch (e) {
        // localStorage not available in Figma sandbox - ignore
        console.log('localStorage not available');
    }

    // Event listeners
    apiKeyInput.addEventListener('input', handleApiKeyChange);
    toggleKeyBtn.addEventListener('click', toggleKeyVisibility);
    contextInput.addEventListener('input', handleContextChange);
    translateBtn.addEventListener('click', handleTranslate);
    cancelBtn.addEventListener('click', handleCancel);
}

function renderLanguageGrid() {
    if (!languageGrid) {
        console.error('Language grid element not found');
        return;
    }

    languageGrid.innerHTML = LANGUAGES.map(lang => `<label class="language-chip" data-code="${lang.code}"><input type="checkbox" value="${lang.code}" /><span>${lang.flag}</span><span>${lang.name}</span></label>`).join('');

    // Add click handlers
    languageGrid.querySelectorAll('.language-chip').forEach(chip => {
        chip.addEventListener('click', (e) => {
            e.preventDefault(); // Prevent default label/checkbox behavior
            const code = (chip as HTMLElement).dataset.code!;
            if (selectedLanguages.has(code)) {
                selectedLanguages.delete(code);
                chip.classList.remove('selected');
            } else {
                selectedLanguages.add(code);
                chip.classList.add('selected');
            }
            updateTranslateButton();
        });
    });
}

function handleApiKeyChange() {
    apiKey = apiKeyInput.value;
    try { localStorage.setItem('openai-api-key', apiKey); } catch (e) { }
    updateTranslateButton();
}

function handleContextChange() {
    try { localStorage.setItem('translation-context', contextInput.value); } catch (e) { }
}

function toggleKeyVisibility() {
    const isPassword = apiKeyInput.type === 'password';
    apiKeyInput.type = isPassword ? 'text' : 'password';
    toggleKeyBtn.textContent = isPassword ? '🙈' : '👁';
}

function updateTranslateButton() {
    const canTranslate =
        apiKey.length > 0 &&
        selectedLanguages.size > 0 &&
        extractedTexts.length > 0;
    translateBtn.disabled = !canTranslate;
}

function renderTextPreview() {
    if (extractedTexts.length === 0) {
        previewSection.classList.add('hidden');
        return;
    }

    previewSection.classList.remove('hidden');
    textCount.textContent = extractedTexts.length.toString();

    textPreview.innerHTML = extractedTexts.slice(0, 10).map(text => `
    <div class="text-item" title="${escapeHtml(text.characters)}">
      ${escapeHtml(text.characters.substring(0, 50))}${text.characters.length > 50 ? '...' : ''}
    </div>
  `).join('');

    if (extractedTexts.length > 10) {
        textPreview.innerHTML += `<div class="text-item">... and ${extractedTexts.length - 10} more</div>`;
    }
}

function escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function handleTranslate() {
    if (!apiKey || selectedLanguages.size === 0 || extractedTexts.length === 0) {
        return;
    }

    const context = contextInput.value || 'General app content';
    const languages = Array.from(selectedLanguages);

    // Show status
    statusSection.classList.remove('hidden');
    translateBtn.disabled = true;

    try {
        // Tell plugin we're starting (to track frame positioning)
        parent.postMessage({
            pluginMessage: {
                type: 'start-translations',
                totalLanguages: languages.length,
                createCopies: createCopiesCheckbox.checked
            }
        }, '*');

        for (let i = 0; i < languages.length; i++) {
            const langCode = languages[i];
            const lang = LANGUAGES.find(l => l.code === langCode)!;

            statusText.textContent = `Translating to ${lang.name}... (${i + 1}/${languages.length})`;
            progressFill.style.width = `${((i) / languages.length) * 100}%`;

            const translatedTexts = await translateWithOpenAI(
                extractedTexts,
                lang.name,
                context
            );

            progressFill.style.width = `${((i + 1) / languages.length) * 100}%`;
            statusText.textContent = `Creating ${lang.name} frame...`;

            // Send this translation immediately to create the frame
            parent.postMessage({
                pluginMessage: {
                    type: 'apply-single-translation',
                    translation: {
                        language: lang.name,
                        languageCode: lang.code,
                        texts: translatedTexts
                    },
                    index: i,
                    createCopies: createCopiesCheckbox.checked
                }
            }, '*');
        }

        statusText.textContent = 'All translations complete!';
        parent.postMessage({ pluginMessage: { type: 'translations-complete' } }, '*');

    } catch (error) {
        const status = document.getElementById('status') as HTMLElement;
        status.classList.add('error');
        statusText.textContent = `Error: ${error instanceof Error ? error.message : 'Translation failed'}`;
        translateBtn.disabled = false;
    }
}

async function translateWithOpenAI(
    texts: TextItem[],
    targetLanguage: string,
    context: string
): Promise<{ id: string; translated: string }[]> {

    const textsToTranslate = texts.map(t => ({
        id: t.id,
        text: t.characters
    }));

    const prompt = `You are a professional app localization expert. Translate the following UI texts to ${targetLanguage}.

Context: ${context}

CRITICAL guidelines for app/UI localization:
- Keep translations SHORT and CONCISE - UI space is limited
- Match or reduce the original character count when possible
- Use common, everyday words that users understand instantly
- Adapt culturally - don't translate literally, localize naturally
- Preserve line breaks and formatting exactly
- Keep brand names, product names, and proper nouns unchanged
- Use the standard UI terminology for the target language
- For action buttons, use imperative verbs (e.g., "Save", "Send", "Next")

Texts to translate (JSON format):
${JSON.stringify(textsToTranslate, null, 2)}

Respond with ONLY a JSON array in this exact format (no markdown, no explanation):
[{"id": "original_id", "translated": "translated text"}, ...]`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: 'You are a professional translator and localization expert. Always respond with valid JSON only.' },
                { role: 'user', content: prompt }
            ],
            temperature: 0.3,
            max_tokens: 4000
        })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'API request failed');
    }

    const data = await response.json();
    const content = data.choices[0].message.content;

    // Parse JSON response
    try {
        // Handle potential markdown code blocks
        let jsonStr = content.trim();
        if (jsonStr.startsWith('```')) {
            jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```/g, '');
        }
        return JSON.parse(jsonStr);
    } catch (e) {
        throw new Error('Failed to parse translation response');
    }
}

function handleCancel() {
    parent.postMessage({ pluginMessage: { type: 'cancel' } }, '*');
}

// Handle messages from plugin code
window.onmessage = (event) => {
    const msg = event.data.pluginMessage;
    if (!msg) return;

    if (msg.type === 'extracted') {
        extractedTexts = msg.texts;
        renderTextPreview();
        updateTranslateButton();
    }

    if (msg.type === 'no-selection') {
        previewSection.classList.add('hidden');
        textPreview.innerHTML = '<div class="text-item">No elements selected</div>';
        extractedTexts = [];
        updateTranslateButton();
    }

    if (msg.type === 'no-text') {
        previewSection.classList.add('hidden');
        textPreview.innerHTML = '<div class="text-item">No text found in selection</div>';
        extractedTexts = [];
        updateTranslateButton();
    }

    if (msg.type === 'success') {
        const status = document.getElementById('status') as HTMLElement;
        status.classList.add('success');
        status.classList.remove('error');
        statusText.textContent = '✓ Translations applied successfully!';
        progressFill.style.width = '100%';

        // Hide spinner
        const spinner = status.querySelector('.spinner') as HTMLElement;
        if (spinner) spinner.style.display = 'none';
    }

    if (msg.type === 'error') {
        const status = document.getElementById('status') as HTMLElement;
        status.classList.add('error');
        statusText.textContent = `Error: ${msg.message}`;
        translateBtn.disabled = false;
    }
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    // DOM already loaded
    init();
}
