var _a;
import { defineConfig } from 'vite';
var base = (_a = process.env.BASE_PATH) !== null && _a !== void 0 ? _a : (process.env.GITHUB_PAGES === 'true' ? '/rdf-demo/' : '/');
export default defineConfig({
    base: base,
});
