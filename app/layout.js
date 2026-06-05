import './globals.css';

export const metadata = {
  title: 'สุ่มรับโค้ดรางวัล',
  description: 'กดสุ่มเพื่อลุ้นรับโค้ดรางวัล',
};

export default function RootLayout({ children }) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
