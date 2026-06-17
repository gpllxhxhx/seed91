const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const files = [
    'frontend/index.html',
    'frontend/js/app.js',
    'frontend/js/api.js',
];

function read(file) {
    return fs.readFileSync(path.join(__dirname, file), 'utf8');
}

function loadCopyAlias() {
    const source = read('frontend/js/copy-alias.js');
    const context = {};
    context.window = context;
    context.globalThis = context;
    vm.runInNewContext(`${source}\n;globalThis.__COPY_ALIAS__ = FrontendCopyAlias;`, context, {
        filename: 'frontend/js/copy-alias.js',
    });
    return context.__COPY_ALIAS__;
}

test('frontend copy removes 网易云 and rewrites 解灰 to 音源补全', () => {
    const combined = files.map(read).join('\n');

    assert.equal(combined.includes('网易云'), false);
    assert.equal(combined.includes('解灰'), false);
    assert.match(combined, /音源补全/);
});

test('dynamic frontend strings are sanitized before rendering', () => {
    const copyAlias = loadCopyAlias();

    assert.equal(copyAlias.sanitizeVisibleCopy('网易云古典榜'), '古典榜');
    assert.equal(copyAlias.sanitizeVisibleCopy('增强解灰 quality'), '增强音源补全 quality');
});
