const http = require('http');
const fs = require('fs');
const WebSocket = require('ws');
const { spawn } = require('child_process');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9256;
const PROFILE = 'C:/Temp/chrome_hero_zoom_fixed';
const ARTIFACT_DIR = 'C:/Users/navneeth 33/.gemini/antigravity/brain/e5c6060f-5867-41ac-a031-b41bcf375972';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function cdpSend(ws, method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = Math.floor(Math.random() * 999999);
    const handler = (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.id === id) {
        ws.off('message', handler);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result || {});
      }
    };
    ws.on('message', handler);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function evalCode(ws, expression) {
  const res = await cdpSend(ws, 'Runtime.evaluate', { expression, returnByValue: true });
  return res.result ? res.result.value : null;
}

async function capture(ws, filename) {
  await evalCode(ws, `
    (() => {
      const map = document.querySelector('[data-testid="digital-twin-3d"]') || document.querySelector('canvas');
      if (map) map.scrollIntoView({ behavior: 'instant', block: 'center' });
    })()
  `);
  await sleep(1000);
  const { data } = await cdpSend(ws, 'Page.captureScreenshot', { format: 'png' });
  const fullPath = `${ARTIFACT_DIR}/${filename}`;
  fs.writeFileSync(fullPath, Buffer.from(data, 'base64'));
  console.log(`Saved screenshot: ${filename}`);
}

async function main() {
  const chrome = spawn(CHROME, [
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${PROFILE}`,
    '--headless=new',
    '--no-sandbox',
    '--window-size=1800,1100',
    'about:blank'
  ]);

  try {
    await sleep(2000);
    const tabs = await new Promise((resolve) => {
      http.get(`http://localhost:${PORT}/json`, res => {
        let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(JSON.parse(d)));
      });
    });

    const ws = new WebSocket(tabs[0].webSocketDebuggerUrl);
    await new Promise(r => ws.on('open', r));

    await cdpSend(ws, 'Runtime.enable');
    await cdpSend(ws, 'Page.enable');
    await cdpSend(ws, 'Page.navigate', { url: 'http://localhost:3000' });
    await sleep(2500);

    // Dismiss walkthrough
    await evalCode(ws, 'localStorage.setItem("whatif_walkthrough_seen", "true"); location.reload();');
    await sleep(2500);

    // Open Simulation Workspace
    await evalCode(ws, 'Array.from(document.querySelectorAll("button")).find(b => b.innerText.includes("Open Simulation Workspace"))?.click()');
    await sleep(2000);

    // Click Step 4
    await evalCode(ws, 'Array.from(document.querySelectorAll("button")).find(b => b.innerText.includes("4. Results & Next Steps") || b.innerText.includes("Results & Next Steps"))?.click()');
    await sleep(2500);

    // Select Vijayawada
    console.log('Selecting Vijayawada...');
    await evalCode(ws, `
      (() => {
        const select = document.getElementById('regional-map-place-select');
        if (select) {
          const opt = Array.from(select.options).find(o => o.text.includes('Vijayawada') || o.value.includes('vijayawada'));
          if (opt) {
            select.value = opt.value;
            select.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }
      })()
    `);
    await sleep(3500);

    // Zoom in using zoom button
    console.log('Zooming into buildings...');
    await evalCode(ws, `
      (() => {
        const zoomInBtn = document.querySelector('button[aria-label="Zoom In 3D Camera"]');
        if (zoomInBtn) {
          for (let i = 0; i < 4; i++) {
            zoomInBtn.click();
          }
        }
      })()
    `);
    await sleep(2000);

    // 1. Capture Daylight Deep Zoom
    console.log('Capturing hero_city_building_deep_zoom.png...');
    await capture(ws, 'hero_city_building_deep_zoom.png');

    // 2. Toggle to HOLO
    console.log('Switching to HOLO...');
    await evalCode(ws, `Array.from(document.querySelectorAll("button")).find(b => b.innerText === "HOLO")?.click()`);
    await sleep(2000);

    // 3. Capture Holographic Deep Zoom
    console.log('Capturing hero_city_building_deep_zoom_holo.png...');
    await capture(ws, 'hero_city_building_deep_zoom_holo.png');

    ws.close();
  } finally {
    chrome.kill();
    console.log('Finished hero city zoom run.');
  }
}

main().catch(err => {
  console.error('Error during capture:', err);
  process.exit(1);
});
