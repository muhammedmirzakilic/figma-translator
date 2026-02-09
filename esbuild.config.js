const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const isWatch = process.argv.includes('--watch');

// Build plugin code (runs in Figma sandbox)
const codeConfig = {
    entryPoints: ['src/code.ts'],
    bundle: true,
    outfile: 'dist/code.js',
    format: 'iife',
    target: 'es2020',
    minify: !isWatch,
};

// Build UI code (will be inlined into HTML)
const uiConfig = {
    entryPoints: ['src/ui.ts'],
    bundle: true,
    write: false, // Don't write to file, we'll inline it
    format: 'iife',
    target: 'es2020',
    minify: !isWatch,
};

async function build() {
    // Ensure dist directory exists
    if (!fs.existsSync('dist')) {
        fs.mkdirSync('dist');
    }

    // Build the main plugin code
    await esbuild.build(codeConfig);

    // Build UI JS (get result in memory)
    const uiResult = await esbuild.build(uiConfig);
    const uiJs = uiResult.outputFiles[0].text;

    // Read CSS
    const css = fs.readFileSync('src/styles.css', 'utf8');

    // Read HTML template and inline CSS and JS
    let html = fs.readFileSync('src/ui.html', 'utf8');

    // Replace external CSS link with inline styles
    html = html.replace(
        '<link rel="stylesheet" href="styles.css">',
        `<style>\n${css}\n</style>`
    );

    // Replace external JS script with inline script
    html = html.replace(
        '<script src="ui.js"></script>',
        `<script>\n${uiJs}\n</script>`
    );

    // Write the combined HTML file
    fs.writeFileSync('dist/ui.html', html);

    console.log('Build complete!');
}

async function watch() {
    // For watch mode, just rebuild on changes
    const codeCtx = await esbuild.context(codeConfig);
    await codeCtx.watch();

    console.log('Watching for changes...');
    console.log('Note: Run "npm run build" to update ui.html after changes');
}

if (isWatch) {
    watch().catch(console.error);
} else {
    build().catch((err) => {
        console.error(err);
        process.exit(1);
    });
}
