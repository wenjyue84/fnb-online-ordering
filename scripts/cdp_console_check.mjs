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
const DEBUG_PORT = 9889;

const consoleMessages = [];
const networkErrors = [];

console.log('Starting Chrome for console check...');
const chrome = spawn(CHROME, [
  `--remote-debugging-port=${DEBUG_PORT}`,
  '--headless=new',
  '--disable-gpu',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-extensions',
  '--window-size=1440,900',
  `--user-data-dir=C:\\Temp\\cdp-console-${Date.now()}`,
], { stdio: 'ignore' });

await new Promise(r => setTimeout(r, 3000));

const versionInfo = await fetch(`http://localhost:${DEBUG_PORT}/json/version`).then(r => r.json());

// Connect to browser to create a new tab
const browserWs = new WebSocket(versionInfo.webSocketDebuggerUrl);
let msgId = 1;
const pending = new Map();
const events = [];

browserWs.on('message', (data) => {
  const msg = JSON.parse(data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id).resolve(msg);
    pending.delete(msg.id);
  }
});

await new Promise(r => browserWs.on('open', r));

function cdpBrowser(method, params = {}) {
  return new Promise((resolve) => {
    const id = msgId++;
    pending.set(id, { resolve });
    browserWs.send(JSON.stringify({ id, method, params }));
  });
}

const newTarget = await cdpBrowser('Target.createTarget', { url: 'about:blank' });
const targetId = newTarget.result.targetId;
browserWs.close();

// Connect to the page
const pageWs = new WebSocket(`ws://localhost:${DEBUG_PORT}/devtools/page/${targetId}`);
const pagePending = new Map();
let pageMsg = 1;
const allEvents = [];

pageWs.on('message', (data) => {
  const msg = JSON.parse(data);
  if (msg.id && pagePending.has(msg.id)) {
    pagePending.get(msg.id).resolve(msg);
    pagePending.delete(msg.id);
  }
  // Capture events
  if (msg.method) {
    allEvents.push(msg);
  }
});

await new Promise(r => pageWs.on('open', r));

function cdp(method, params = {}) {
  return new Promise((resolve) => {
    const id = pageMsg++;
    pagePending.set(id, { resolve });
    pageWs.send(JSON.stringify({ id, method, params }));
  });
}

// Enable everything
await cdp('Runtime.enable');
await cdp('Console.enable');
await cdp('Network.enable');
await cdp('Page.enable');

// Set cookie
await cdp('Network.setCookie', {
  name: 'admin_session',
  value: TOKEN,
  domain: 'localhost',
  path: '/',
  httpOnly: true
});

// Navigate to hub page
await cdp('Page.navigate', { url: 'http://localhost:3031/admin/ai-waiter-hub' });
console.log('Navigating...');

// Wait for page load
await new Promise(r => setTimeout(r, 6000));

// Take a full-page screenshot
const ss = await cdp('Page.captureScreenshot', {
  format: 'png',
  captureBeyondViewport: true,
  clip: { x: 0, y: 0, width: 1440, height: 900, scale: 1 }
});
if (ss.result && ss.result.data) {
  const imgBytes = Buffer.from(ss.result.data, 'base64');
  writeFileSync(`${SCRIPTS_DIR}/ai-waiter-hub-full.png`, imgBytes);
  console.log('Full screenshot saved:', imgBytes.length, 'bytes');
}

// Collect console messages and errors
const consoleMsgs = allEvents.filter(e =>
  e.method === 'Console.messageAdded' ||
  e.method === 'Runtime.consoleAPICalled' ||
  e.method === 'Runtime.exceptionThrown'
);

const networkFailed = allEvents.filter(e => e.method === 'Network.loadingFailed');
const networkReqs = allEvents.filter(e => e.method === 'Network.requestWillBeSent');

console.log('\n=== CONSOLE MESSAGES ===');
consoleMsgs.forEach(e => {
  if (e.method === 'Console.messageAdded') {
    const m = e.params.message;
    console.log(`[${m.level}] ${m.text}`);
  } else if (e.method === 'Runtime.consoleAPICalled') {
    const args = e.params.args.map(a => a.value || a.description || '').join(' ');
    console.log(`[${e.params.type}] ${args}`);
  } else if (e.method === 'Runtime.exceptionThrown') {
    console.log('[EXCEPTION]', JSON.stringify(e.params.exceptionDetails));
  }
});

console.log('\n=== FAILED NETWORK REQUESTS ===');
networkFailed.forEach(e => {
  const reqId = e.params.requestId;
  const req = networkReqs.find(r => r.params.requestId === reqId);
  const url = req ? req.params.request.url : 'unknown';
  console.log(`FAILED: ${url} - ${e.params.errorText}`);
});

console.log('\n=== KEY NETWORK REQUESTS ===');
networkReqs.filter(e => e.params.request.url.includes('localhost:3031')).forEach(e => {
  console.log(`  ${e.params.request.method} ${e.params.request.url}`);
});

pageWs.close();
chrome.kill();
process.exit(0);
