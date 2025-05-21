const puppeteer = require('puppeteer');
const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 3002 });

let currentBrowser = null;
let currentPage = null;

console.log('WebSocketサーバー起動中... ws://localhost:3002');

wss.on('connection', (ws) => {
  ws.on('message', async (message) => {
    const url = message.toString().trim();
    console.log('受信したURL:', url);

    // 前回のブラウザセッションを閉じる
    if (currentBrowser) {
      try { await currentBrowser.close(); } catch (e) {}
      currentBrowser = null;
      currentPage = null;
    }

    // ログイン済みChromeプロファイルを利用（手動で一度Googleログインしておく）
    currentBrowser = await puppeteer.launch({
      headless: false, // ←最初はfalseで手動ログイン確認を推奨
      userDataDir: './puppeteer_profile', // Chromeプロファイルディレクトリ
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
      ],
      // executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' // WindowsでChrome指定したい時
    });

    currentPage = await currentBrowser.newPage();
    await currentPage.goto(url, { waitUntil: 'networkidle2' });

    // チャット欄のDOMが出現するまで待つ（親要素で検知しやすく）
    await currentPage.waitForSelector('yt-live-chat-app', { timeout: 20000 });

    // exposeFunctionでNode側のws.sendをページに渡す
    await currentPage.exposeFunction('sendChatToWS', (data) => {
      ws.send(JSON.stringify(data));
    });

    // ページ側でチャットを監視（改善版！itemsを全て監視）
    await currentPage.evaluate(() => {
      if (window._myChatObservers) {
        window._myChatObservers.forEach(o => o.disconnect());
      }
      window._myChatObservers = [];
      // "yt-live-chat-app" 内のすべての #items を監視
      document.querySelectorAll('yt-live-chat-app #items').forEach(items => {
        const observer = new MutationObserver((mutationsList) => {
          for (const mutation of mutationsList) {
            mutation.addedNodes.forEach((node) => {
              if (node.nodeType === 1) {
                const author = node.querySelector('#author-name')?.textContent?.trim();
                const text = node.querySelector('#message')?.textContent?.trim();
                if (author && text) {
                  window.sendChatToWS({ author, text });
                }
              }
            });
          }
        });
        observer.observe(items, { childList: true });
        window._myChatObservers.push(observer);
      });
    });

    ws.on('close', async () => {
      if (currentBrowser) {
        try { await currentBrowser.close(); } catch (e) {}
        currentBrowser = null;
        currentPage = null;
      }
    });
  });
});
