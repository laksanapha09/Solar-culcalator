import "./globals.css";

export const metadata = {
  title: "Solar Calculator",
  description: "คำนวณพลังงานแสงอาทิตย์และระยะเวลาคืนทุน",
};

export default function RootLayout({ children }) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
