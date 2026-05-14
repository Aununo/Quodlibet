export const metadata = {
  title: "Quodlibet · 答辩陪练",
  description: "Ask me anything — 上传 PPT，让 Claude 扮演评委陪你练答辩",
};

const GLOBAL_CSS = `
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei',
      'Helvetica Neue', Arial, sans-serif;
    background: #f7f8fa;
    color: #1f2937;
    min-height: 100vh;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
  button { font-family: inherit; }
  button:disabled { opacity: 0.5; cursor: not-allowed !important; }
  textarea::placeholder, input::placeholder { color: #9ca3af; }
  @keyframes qd-spin { to { transform: rotate(360deg); } }
  @keyframes qd-pulse { 0%, 100% { opacity: 0.35; transform: scale(0.9); } 50% { opacity: 1; transform: scale(1.15); } }
  @keyframes qd-fade-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
  @keyframes qd-progress-slide {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(250%); }
  }
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <head>
        <style dangerouslySetInnerHTML={{ __html: GLOBAL_CSS }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
