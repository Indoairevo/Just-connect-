import "./globals.css";

export const metadata = {
  title: "Nexora. Digital growth, made simple.",
  description: "A digital growth studio for ambitious businesses ready to be impossible to ignore.",
};

export default function RootLayout({ children }) {
  return <html lang="en"><body>{children}</body></html>;
}