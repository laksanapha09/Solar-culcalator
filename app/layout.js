import "./globals.css";

export const metadata = {
  title: "Solar Calculator",
  description: "คำนวณพลังงานแสงอาทิตย์และระยะเวลาคืนทุน",
};

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fff1dc" },
    { media: "(prefers-color-scheme: dark)", color: "#231b10" },
  ],
};

export default function RootLayout({ children }) {
  return (
    <html lang="th">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;500;600;700&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
