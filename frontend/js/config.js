// Same-origin deployment default: expose the backend through /api on the web domain.
// Example: https://music.example.com/api -> local backend service.
window.NCM_API_BASE = window.NCM_API_BASE || `${window.location.origin}/api`;
