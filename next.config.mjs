/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      { source: "/api/:path*", destination: "http://localhost:8080/api/:path*" },
      { source: "/login.html", destination: "http://localhost:8080/login.html" },
      { source: "/admin.html", destination: "http://localhost:8080/admin.html" },
      { source: "/client.html", destination: "http://localhost:8080/client.html" },
    ];
  },
};

export default nextConfig;