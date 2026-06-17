const SOURCE_BRAND_PATTERN = /\u7f51\u6613\u4e91/g;
const UNBLOCK_PATTERN = /\u89e3\u7070/g;

const FrontendCopyAlias = {
    sanitizeVisibleCopy(value) {
        if (value == null) return '';
        return String(value)
            .replace(SOURCE_BRAND_PATTERN, '')
            .replace(UNBLOCK_PATTERN, '音源补全')
            .replace(/\s{2,}/g, ' ')
            .trim();
    },
};

if (typeof window !== 'undefined') {
    window.FrontendCopyAlias = FrontendCopyAlias;
}

if (typeof globalThis !== 'undefined') {
    globalThis.FrontendCopyAlias = FrontendCopyAlias;
}
