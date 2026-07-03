import "./globals.css";

export const metadata = {
  title: "T o T 匿名信箱",
  description: "To Tyycc 的个人匿名信箱。你想说的话，我都会认真听。",
  appleWebApp: {
    capable: true,
    title: "T o T 匿名信箱"
  },
  formatDetection: {
    telephone: false
  }
};

export const viewport = {
  themeColor: "#fff7f8",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover"
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
