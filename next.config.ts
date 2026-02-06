import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Webpack configuration for PSPDFKit
   * PSPDFKit uses WebAssembly and has specific module requirements
   */
  webpack: (config) => {
    // Handle PSPDFKit's canvas and encoding dependencies
    config.resolve.alias = {
      ...config.resolve.alias,
      canvas: false,
      encoding: false,
    };

    // Ensure WASM files are handled correctly
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };

    return config;
  },

  /**
   * Headers for PSPDFKit WASM files
   * SharedArrayBuffer requires specific CORS headers
   */
  async headers() {
    return [
      {
        source: "/pspdfkit-lib/:path*",
        headers: [
          {
            key: "Cross-Origin-Embedder-Policy",
            value: "require-corp",
          },
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
