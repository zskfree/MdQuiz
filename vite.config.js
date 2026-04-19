import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(function (_a) {
    var command = _a.command;
    return ({
        plugins: [react()],
        // Use repository sub-path in production for GitHub Pages project site.
        base: command === 'build' ? '/MdQuiz/' : '/',
        server: {
            host: '127.0.0.1',
            port: 5173,
            strictPort: true,
        },
    });
});
