import { spawn } from 'child_process';
import { writeFileSync } from 'fs';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const WebSocket = require('../node_modules/ws/index.js');

const TOKEN = process.env.TOKEN;
const SCRIPTS_DIR = __dirname;
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DEBUG_PORT = 9888;

console.log('Starting Chrome...');
const chrome = spawn(CHROME, [
  `--remote-debugging-port=${DEBUG_PORT}`,
  '--headless=new',
  '--disable-gpu',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-extensions',
  '--window-size=1440,900',
  `--user-data-dir=C:\\Temp\\cdp-ss-${Date.now()}`,
], { stdio: 'ignore' });

await new Promise(r => setTimeout(r, 3000));

// Get the browser-level WebSocket endpoint (not a page target)
const versionInfo = await fetch(`http://localhost:${DEBUG_PORT}/json/version`).then(r => r.json());
console.log('Browser WS:', versionInfo.webSocketDebuggerUrl);

// Connect to browser-level endpoint to create a new target
const browserWs = new WebSocket(versionInfo.webSocketDebuggerUrl);
let msgId = 1;
const pending = new Map();

browserWs.on('message', (data) => {
  const msg = JSON.parse(data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id).resolve(msg);
    pending.delete(msg.id);
  }
});

await new Promise(r => browserWs.on('open', r));
console.log('Browser WebSocket connected');

function cdpBrowser(method, params = {}) {
  return new Promise((resolve) => {
    const id = msgId++;
    pending.set(id, { resolve });
    browserWs.send(JSON.stringify({ id, method, params }));
  });
}

// Create a new page target
const newTarget = await cdpBrowser('Target.createTarget', { url: 'about:blank' });
const targetId = newTarget.result.targetId;
console.log('New target created:', targetId);
browserWs.close();

// Connect to the new page target
const pageWsUrl = `ws://localhost:${DEBUG_PORT}/devtools/page/${targetId}`;
const pageWs = new WebSocket(pageWsUrl);
const pagePending = new Map();
let pageMsg = 1;

pageWs.on('message', (data) => {
  const msg = JSON.parse(data);
  if (msg.id && pagePending.has(msg.id)) {
    pagePending.get(msg.id).resolve(msg);
    pagePending.delete(msg.id);
  }
});

await new Promise(r => pageWs.on('open', r));
console.log('Page WebSocket connected');

function cdp(method, params = {}) {
  return new Promise((resolve) => {
    const id = pageMsg++;
    pagePending.set(id, { resolve });
    pageWs.send(JSON.stringify({ id, method, params }));
  });
}

// Enable Network and set cookie
await cdp('Network.enable');
await cdp('Network.setCookie', {
  name: 'admin_session',
  value: TOKEN,
  domain: 'localhost',
  path: '/',
  httpOnly: true
});
console.log('Cookie set');

// Enable Page and navigate
await cdp('Page.enable');

// Navigate to hub page
const navResult = await cdp('Page.navigate', { url: 'http://localhost:3031/admin/ai-waiter-hub' });
console.log('Navigation result:', JSON.stringify(navResult.result));

// Wait for page to load fully
await new Promise(r => setTimeout(r, 5000));

// Take screenshot of hub
const ss = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
if (ss.result && ss.result.data) {
  const imgBytes = Buffer.from(ss.result.data, 'base64');
  writeFileSync(`${SCRIPTS_DIR}/ai-waiter-hub.png`, imgBytes);
  console.log('Hub screenshot saved:', imgBytes.length, 'bytes');
} else {
  console.log('Screenshot failed:', JSON.stringify(ss));
}

// Navigate to admin dashboard
await cdp('Page.navigate', { url: 'http://localhost:3031/admin' });
await new Promise(r => setTimeout(r, 3000));
const ss2 = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
if (ss2.result && ss2.result.data) {
  const imgBytes2 = Buffer.from(ss2.result.data, 'base64');
  writeFileSync(`${SCRIPTS_DIR}/admin-with-ai-waiter-tab.png`, imgBytes2);
  console.log('Admin screenshot saved:', imgBytes2.length, 'bytes');
} else {
  console.log('Admin screenshot failed:', JSON.stringify(ss2));
}

pageWs.close();
chrome.kill();
process.exit(0);
