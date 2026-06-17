const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const files = [
    'frontend/index.html',
    'frontend/js/app.js',
    'frontend/js/api.js',
];

function read(file) {
    return fs.readFileSync(path.join(__dirname, file), 'utf8');
}

test('frontend copy removes 网易云 and rewrites 解灰 to 音源补全', () => {
    const combined = files.map(read).join('\n');

    assert.equal(combined.includes('网易云'), false);
    assert.equal(combined.includes('解灰'), false);
    assert.match(combined, /音源补全/);
});
