import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    server: {
        port: 3000,
        proxy: {
            // Proxy specific superadmin routes first
            '/superadmin/abacus-levels': {
                target: 'http://localhost:9000',
                changeOrigin: true,
                secure: false,
            },
            '/superadmin/abacus/courses': {
                target: 'http://localhost:9000',
                changeOrigin: true,
                secure: false,
            },
            '/superadmin/abacus-worksheets': {
                target: 'http://localhost:9000',
                changeOrigin: true,
                secure: false,
            },
            '/superadmin/abacus/students': {
                target: 'http://localhost:9000',
                changeOrigin: true,
                secure: false,
            },
            '/superadmin/abacus/enrollments': {
                target: 'http://localhost:9000',
                changeOrigin: true,
                secure: false,
            },
            // Proxy general API requests
            '/auth': {
                target: 'http://localhost:9000',
                changeOrigin: true,
                secure: false,
            },
            '/api': {
                target: 'http://localhost:9000',
                changeOrigin: true,
                secure: false,
            },
            '/health': {
                target: 'http://localhost:9000',
                changeOrigin: true,
                secure: false,
            },
        },
    },
    appType: 'spa',
    base: '/',
});
