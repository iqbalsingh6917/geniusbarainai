// vite.config.js
import { defineConfig } from "file:///E:/geniusbrainai/beats-lms-v2/node_modules/.pnpm/vite@5.4.21_@types+node@20.19.25/node_modules/vite/dist/node/index.js";
import react from "file:///E:/geniusbrainai/beats-lms-v2/node_modules/.pnpm/@vitejs+plugin-react@4.7.0_vite@5.4.21_@types+node@20.19.25_/node_modules/@vitejs/plugin-react/dist/index.js";
var vite_config_default = defineConfig({
  plugins: [react()],
  server: {
    port: 3e3,
    proxy: {
      // Proxy specific superadmin routes first
      "/superadmin/abacus-levels": {
        target: "http://localhost:9000",
        changeOrigin: true,
        secure: false
      },
      "/superadmin/abacus/courses": {
        target: "http://localhost:9000",
        changeOrigin: true,
        secure: false
      },
      "/superadmin/abacus-worksheets": {
        target: "http://localhost:9000",
        changeOrigin: true,
        secure: false
      },
      "/superadmin/abacus/students": {
        target: "http://localhost:9000",
        changeOrigin: true,
        secure: false
      },
      "/superadmin/abacus/enrollments": {
        target: "http://localhost:9000",
        changeOrigin: true,
        secure: false
      },
      // Proxy general API requests
      "/auth": {
        target: "http://localhost:9000",
        changeOrigin: true,
        secure: false
      },
      "/api": {
        target: "http://localhost:9000",
        changeOrigin: true,
        secure: false
      },
      "/health": {
        target: "http://localhost:9000",
        changeOrigin: true,
        secure: false
      }
    }
  },
  appType: "spa",
  base: "/"
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJFOlxcXFxnZW5pdXNicmFpbmFpXFxcXGJlYXRzLWxtcy12MlxcXFxhcHBzXFxcXHdlYlwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiRTpcXFxcZ2VuaXVzYnJhaW5haVxcXFxiZWF0cy1sbXMtdjJcXFxcYXBwc1xcXFx3ZWJcXFxcdml0ZS5jb25maWcuanNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0U6L2dlbml1c2JyYWluYWkvYmVhdHMtbG1zLXYyL2FwcHMvd2ViL3ZpdGUuY29uZmlnLmpzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndml0ZSc7XHJcbmltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdCc7XHJcbi8vIGh0dHBzOi8vdml0ZWpzLmRldi9jb25maWcvXHJcbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XHJcbiAgICBwbHVnaW5zOiBbcmVhY3QoKV0sXHJcbiAgICBzZXJ2ZXI6IHtcclxuICAgICAgICBwb3J0OiAzMDAwLFxyXG4gICAgICAgIHByb3h5OiB7XHJcbiAgICAgICAgICAgIC8vIFByb3h5IHNwZWNpZmljIHN1cGVyYWRtaW4gcm91dGVzIGZpcnN0XHJcbiAgICAgICAgICAgICcvc3VwZXJhZG1pbi9hYmFjdXMtbGV2ZWxzJzoge1xyXG4gICAgICAgICAgICAgICAgdGFyZ2V0OiAnaHR0cDovL2xvY2FsaG9zdDo5MDAwJyxcclxuICAgICAgICAgICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcclxuICAgICAgICAgICAgICAgIHNlY3VyZTogZmFsc2UsXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICcvc3VwZXJhZG1pbi9hYmFjdXMvY291cnNlcyc6IHtcclxuICAgICAgICAgICAgICAgIHRhcmdldDogJ2h0dHA6Ly9sb2NhbGhvc3Q6OTAwMCcsXHJcbiAgICAgICAgICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXHJcbiAgICAgICAgICAgICAgICBzZWN1cmU6IGZhbHNlLFxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAnL3N1cGVyYWRtaW4vYWJhY3VzLXdvcmtzaGVldHMnOiB7XHJcbiAgICAgICAgICAgICAgICB0YXJnZXQ6ICdodHRwOi8vbG9jYWxob3N0OjkwMDAnLFxyXG4gICAgICAgICAgICAgICAgY2hhbmdlT3JpZ2luOiB0cnVlLFxyXG4gICAgICAgICAgICAgICAgc2VjdXJlOiBmYWxzZSxcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgJy9zdXBlcmFkbWluL2FiYWN1cy9zdHVkZW50cyc6IHtcclxuICAgICAgICAgICAgICAgIHRhcmdldDogJ2h0dHA6Ly9sb2NhbGhvc3Q6OTAwMCcsXHJcbiAgICAgICAgICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXHJcbiAgICAgICAgICAgICAgICBzZWN1cmU6IGZhbHNlLFxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAnL3N1cGVyYWRtaW4vYWJhY3VzL2Vucm9sbG1lbnRzJzoge1xyXG4gICAgICAgICAgICAgICAgdGFyZ2V0OiAnaHR0cDovL2xvY2FsaG9zdDo5MDAwJyxcclxuICAgICAgICAgICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcclxuICAgICAgICAgICAgICAgIHNlY3VyZTogZmFsc2UsXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIC8vIFByb3h5IGdlbmVyYWwgQVBJIHJlcXVlc3RzXHJcbiAgICAgICAgICAgICcvYXV0aCc6IHtcclxuICAgICAgICAgICAgICAgIHRhcmdldDogJ2h0dHA6Ly9sb2NhbGhvc3Q6OTAwMCcsXHJcbiAgICAgICAgICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXHJcbiAgICAgICAgICAgICAgICBzZWN1cmU6IGZhbHNlLFxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAnL2FwaSc6IHtcclxuICAgICAgICAgICAgICAgIHRhcmdldDogJ2h0dHA6Ly9sb2NhbGhvc3Q6OTAwMCcsXHJcbiAgICAgICAgICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXHJcbiAgICAgICAgICAgICAgICBzZWN1cmU6IGZhbHNlLFxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAnL2hlYWx0aCc6IHtcclxuICAgICAgICAgICAgICAgIHRhcmdldDogJ2h0dHA6Ly9sb2NhbGhvc3Q6OTAwMCcsXHJcbiAgICAgICAgICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXHJcbiAgICAgICAgICAgICAgICBzZWN1cmU6IGZhbHNlLFxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgIH0sXHJcbiAgICB9LFxyXG4gICAgYXBwVHlwZTogJ3NwYScsXHJcbiAgICBiYXNlOiAnLycsXHJcbn0pO1xyXG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQThTLFNBQVMsb0JBQW9CO0FBQzNVLE9BQU8sV0FBVztBQUVsQixJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUN4QixTQUFTLENBQUMsTUFBTSxDQUFDO0FBQUEsRUFDakIsUUFBUTtBQUFBLElBQ0osTUFBTTtBQUFBLElBQ04sT0FBTztBQUFBO0FBQUEsTUFFSCw2QkFBNkI7QUFBQSxRQUN6QixRQUFRO0FBQUEsUUFDUixjQUFjO0FBQUEsUUFDZCxRQUFRO0FBQUEsTUFDWjtBQUFBLE1BQ0EsOEJBQThCO0FBQUEsUUFDMUIsUUFBUTtBQUFBLFFBQ1IsY0FBYztBQUFBLFFBQ2QsUUFBUTtBQUFBLE1BQ1o7QUFBQSxNQUNBLGlDQUFpQztBQUFBLFFBQzdCLFFBQVE7QUFBQSxRQUNSLGNBQWM7QUFBQSxRQUNkLFFBQVE7QUFBQSxNQUNaO0FBQUEsTUFDQSwrQkFBK0I7QUFBQSxRQUMzQixRQUFRO0FBQUEsUUFDUixjQUFjO0FBQUEsUUFDZCxRQUFRO0FBQUEsTUFDWjtBQUFBLE1BQ0Esa0NBQWtDO0FBQUEsUUFDOUIsUUFBUTtBQUFBLFFBQ1IsY0FBYztBQUFBLFFBQ2QsUUFBUTtBQUFBLE1BQ1o7QUFBQTtBQUFBLE1BRUEsU0FBUztBQUFBLFFBQ0wsUUFBUTtBQUFBLFFBQ1IsY0FBYztBQUFBLFFBQ2QsUUFBUTtBQUFBLE1BQ1o7QUFBQSxNQUNBLFFBQVE7QUFBQSxRQUNKLFFBQVE7QUFBQSxRQUNSLGNBQWM7QUFBQSxRQUNkLFFBQVE7QUFBQSxNQUNaO0FBQUEsTUFDQSxXQUFXO0FBQUEsUUFDUCxRQUFRO0FBQUEsUUFDUixjQUFjO0FBQUEsUUFDZCxRQUFRO0FBQUEsTUFDWjtBQUFBLElBQ0o7QUFBQSxFQUNKO0FBQUEsRUFDQSxTQUFTO0FBQUEsRUFDVCxNQUFNO0FBQ1YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
