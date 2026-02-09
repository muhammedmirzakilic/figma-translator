// Types for messages between UI and plugin code
interface ExtractedText {
    id: string;
    characters: string;
    name: string;
}

interface ExtractedData {
    type: 'extracted';
    texts: ExtractedText[];
    frameId: string | null;
    frameName: string | null;
}

interface TranslatedData {
    type: 'apply-translations';
    translations: {
        language: string;
        languageCode: string;
        texts: { id: string; translated: string }[];
    }[];
    createCopies: boolean;
}

// Show the UI
figma.showUI(__html__, { width: 420, height: 560 });

// Extract text from selected nodes
function extractTextNodes(node: SceneNode): ExtractedText[] {
    const texts: ExtractedText[] = [];

    if (node.type === 'TEXT') {
        texts.push({
            id: node.id,
            characters: node.characters,
            name: node.name,
        });
    }

    // Recursively check children
    if ('children' in node) {
        for (const child of node.children) {
            texts.push(...extractTextNodes(child));
        }
    }

    return texts;
}

// Handle selection change
function handleSelectionChange() {
    const selection = figma.currentPage.selection;

    if (selection.length === 0) {
        figma.ui.postMessage({ type: 'no-selection' });
        return;
    }

    const allTexts: ExtractedText[] = [];
    let frameId: string | null = null;
    let frameName: string | null = null;

    // Get frame info if a frame is selected
    if (selection.length === 1 && selection[0].type === 'FRAME') {
        frameId = selection[0].id;
        frameName = selection[0].name;
    }

    for (const node of selection) {
        allTexts.push(...extractTextNodes(node));
    }

    if (allTexts.length === 0) {
        figma.ui.postMessage({ type: 'no-text' });
        return;
    }

    const data: ExtractedData = {
        type: 'extracted',
        texts: allTexts,
        frameId,
        frameName,
    };

    figma.ui.postMessage(data);
}

// Initial extraction
handleSelectionChange();

// Listen for selection changes
figma.on('selectionchange', handleSelectionChange);

// State for progressive translation
let originalFrame: FrameNode | null = null;
let originalFrameName: string = '';
let translationIndex: number = 0;
let nextYPosition: number = 0;

// Find empty Y position below the original frame (avoiding collisions)
function findEmptyYPosition(frame: FrameNode, gap: number): number {
    const page = figma.currentPage;
    const frameX = frame.x;
    const frameWidth = frame.width;
    const frameHeight = frame.height;

    // Start below the original frame
    let candidateY = frame.y + frameHeight + gap;

    // Check all top-level nodes on the page for collisions
    const siblings = page.children.filter(node => node.id !== frame.id);

    let foundEmpty = false;
    while (!foundEmpty) {
        foundEmpty = true;
        for (const sibling of siblings) {
            // Check if sibling overlaps horizontally with our frame
            const siblingRight = sibling.x + sibling.width;
            const frameRight = frameX + frameWidth;
            const horizontalOverlap = !(sibling.x >= frameRight || siblingRight <= frameX);

            if (horizontalOverlap) {
                // Check if sibling is in our candidate Y range
                const siblingBottom = sibling.y + sibling.height;
                const candidateBottom = candidateY + frameHeight;
                const verticalOverlap = !(sibling.y >= candidateBottom || siblingBottom <= candidateY);

                if (verticalOverlap) {
                    // Collision! Move below this sibling
                    candidateY = siblingBottom + gap;
                    foundEmpty = false;
                    break;
                }
            }
        }
    }

    return candidateY;
}

// Handle messages from UI
figma.ui.onmessage = async (msg: any) => {
    if (msg.type === 'start-translations') {
        // Store reference to original frame for progressive updates
        const selection = figma.currentPage.selection;
        if (selection.length === 1 && selection[0].type === 'FRAME') {
            originalFrame = selection[0] as FrameNode;
            originalFrameName = originalFrame.name;
            // Find initial empty position below original frame
            nextYPosition = findEmptyYPosition(originalFrame, 100);
        } else {
            originalFrame = null;
        }
        translationIndex = 0;
    }

    if (msg.type === 'apply-single-translation') {
        const translation = msg.translation;
        const createCopies = msg.createCopies;

        try {
            if (createCopies && originalFrame) {
                // Clone and apply - place at next empty Y position
                const clone = originalFrame.clone();
                clone.y = nextYPosition;
                clone.name = `${originalFrameName}_${translation.languageCode}`;

                // Update nextYPosition for the next frame
                nextYPosition = clone.y + clone.height + 100;

                // Map original IDs to clone IDs
                const idMap = buildIdMapping(originalFrame, clone, translation.texts);

                // Apply translations to clone
                for (const [cloneId, translated] of idMap) {
                    const node = figma.getNodeById(cloneId);
                    if (node && node.type === 'TEXT') {
                        await loadFontsForNode(node);
                        node.characters = translated;
                    }
                }

                translationIndex++;
            } else {
                // Apply in-place (first translation only)
                await applyTranslationsToNodes(translation.texts);
            }
        } catch (error) {
            figma.ui.postMessage({
                type: 'error',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    if (msg.type === 'translations-complete') {
        figma.ui.postMessage({ type: 'success' });
    }

    if (msg.type === 'apply-translations') {
        // Legacy batch handler (keep for backwards compatibility)
        const data = msg as TranslatedData;

        try {
            if (data.createCopies) {
                await createLanguageCopies(data);
            } else {
                if (data.translations.length > 0) {
                    await applyTranslationsToNodes(data.translations[0].texts);
                }
            }

            figma.ui.postMessage({ type: 'success' });
        } catch (error) {
            figma.ui.postMessage({
                type: 'error',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    if (msg.type === 'cancel') {
        figma.closePlugin();
    }
};

async function loadFontsForNode(node: TextNode) {
    // Handle mixed fonts in text
    const fontName = node.fontName;
    if (fontName === figma.mixed) {
        // Load all fonts used in this text node
        const len = node.characters.length;
        for (let i = 0; i < len; i++) {
            const font = node.getRangeFontName(i, i + 1) as FontName;
            await figma.loadFontAsync(font);
        }
    } else {
        await figma.loadFontAsync(fontName);
    }
}

async function applyTranslationsToNodes(texts: { id: string; translated: string }[]) {
    for (const text of texts) {
        const node = figma.getNodeById(text.id);
        if (node && node.type === 'TEXT') {
            await loadFontsForNode(node);
            node.characters = text.translated;
        }
    }
}

async function createLanguageCopies(data: TranslatedData) {
    const selection = figma.currentPage.selection;

    if (selection.length !== 1 || selection[0].type !== 'FRAME') {
        // If not a single frame, just apply the first translation to current selection
        if (data.translations.length > 0) {
            await applyTranslationsToNodes(data.translations[0].texts);
        }
        return;
    }

    const originalFrame = selection[0] as FrameNode;
    const originalName = originalFrame.name;

    // Create copies for EACH language (original stays untouched)
    let legacyNextY = findEmptyYPosition(originalFrame, 100);

    for (let i = 0; i < data.translations.length; i++) {
        const translation = data.translations[i];

        // Clone the original frame for each language - place at next empty position
        const clone = originalFrame.clone();
        clone.y = legacyNextY;
        clone.name = `${originalName}_${translation.languageCode}`;

        // Update position for next frame
        legacyNextY = clone.y + clone.height + 100;

        // Map original IDs to clone IDs
        const idMap = buildIdMapping(originalFrame, clone, translation.texts);

        // Apply translations to clone
        for (const [cloneId, translated] of idMap) {
            const node = figma.getNodeById(cloneId);
            if (node && node.type === 'TEXT') {
                await loadFontsForNode(node);
                node.characters = translated;
            }
        }
    }
}

async function applyTranslationsInFrame(idMap: Map<string, string>) {
    for (const [id, translated] of idMap) {
        const node = figma.getNodeById(id);
        if (node && node.type === 'TEXT') {
            await loadFontsForNode(node);
            node.characters = translated;
        }
    }
}

function buildIdMapping(original: FrameNode, clone: FrameNode, texts: { id: string; translated: string }[]): Map<string, string> {
    const result = new Map<string, string>();

    // Get flattened list of text nodes from both
    const originalTexts = extractTextNodes(original);
    const cloneTexts = extractTextNodes(clone);

    // Match by index (since clone preserves order)
    for (let i = 0; i < originalTexts.length && i < cloneTexts.length; i++) {
        const originalId = originalTexts[i].id;
        const cloneId = cloneTexts[i].id;

        const translation = texts.find(t => t.id === originalId);
        if (translation) {
            result.set(cloneId, translation.translated);
        }
    }

    return result;
}
