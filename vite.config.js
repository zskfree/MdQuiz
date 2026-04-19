import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
function normalizeBasePath(input) {
    var withSlashes = "/".concat(input.replace(/^\/+|\/+$/g, ''), "/");
    return withSlashes === '//' ? '/' : withSlashes;
}
function readEnv(name) {
    var _a;
    var envSource = (_a = globalThis.process) === null || _a === void 0 ? void 0 : _a.env;
    return envSource === null || envSource === void 0 ? void 0 : envSource[name];
}
function resolveProductionBase() {
    var _a;
    var envBase = readEnv('VITE_BASE_PATH');
    if (envBase && envBase.trim().length > 0) {
        return normalizeBasePath(envBase);
    }
    var repository = (_a = readEnv('GITHUB_REPOSITORY')) === null || _a === void 0 ? void 0 : _a.split('/')[1];
    if (!repository) {
        return '/MdQuiz/';
    }
    if (repository.toLowerCase().slice(-10) === '.github.io') {
        return '/';
    }
    return normalizeBasePath(repository);
}
export default defineConfig(function (_a) {
    var command = _a.command;
    return ({
        plugins: [react()],
        // Build base path is inferred from CI repository to avoid hardcoded project paths.
        base: command === 'build' ? resolveProductionBase() : '/',
        server: {
            host: '127.0.0.1',
            port: 5173,
            strictPort: true,
        },
    });
});
