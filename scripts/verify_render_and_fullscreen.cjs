const http = require('http');
const fs = require('fs');
const WebSocket = require('ws');
const { spawn } = require('child_process');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9248;
const PROFILE = 'C:/Temp/chrome_verify_lifecycle';
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

    // Set walkthrough as seen and reload
    await evalCode(ws, 'localStorage.setItem("whatif_walkthrough_seen", "true"); location.reload();');
    await sleep(2500);

    // Open Simulation Workspace
    await evalCode(ws, 'Array.from(document.querySelectorAll("button")).find(b => b.innerText.includes("Open Simulation Workspace"))?.click()');
    await sleep(2000);

    // Click Step 4 (Results & Next Steps)
    await evalCode(ws, 'Array.from(document.querySelectorAll("button")).find(b => b.innerText.includes("4. Results & Next Steps") || b.innerText.includes("Results & Next Steps"))?.click()');
    await sleep(2500);

    // Scroll map into center
    await evalCode(ws, `
      (() => {
        const map = document.querySelector('[data-testid="digital-twin-3d"]') || document.querySelector('canvas');
        if (map) map.scrollIntoView({ behavior: 'instant', block: 'center' });
      })()
    `);
    await sleep(1500);

    // 1. Verify Normal 3D daylight rendering
    console.log('Capturing verify_normal_3d_lifecycle.png...');
    await capture(ws, 'verify_normal_3d_lifecycle.png');

    // 2. Click HOLO button
    console.log('Toggling to HOLO...');
    await evalCode(ws, `Array.from(document.querySelectorAll("button")).find(b => b.innerText === "HOLO")?.click()`);
    await sleep(1500);
    console.log('Capturing verify_holo_3d_lifecycle.png...');
    await capture(ws, 'verify_holo_3d_lifecycle.png');

    // 3. Switch back to 3D (Normal)
    console.log('Switching back to 3D...');
    await evalCode(ws, `Array.from(document.querySelectorAll("button")).find(b => b.innerText === "3D")?.click()`);
    await sleep(1500);

    // 4. Test Fullscreen Toggle
    console.log('Testing Fullscreen Toggle...');
    await evalCode(ws, `
      (() => {
        const fsBtn = document.querySelector('button[aria-label="Toggle Fullscreen"]');
        if (fsBtn) fsBtn.click();
      })()
    `);
    await sleep(2000);
    console.log('Capturing verify_fullscreen_active.png...');
    await capture(ws, 'verify_fullscreen_active.png');

    // 5. Exit Fullscreen
    console.log('Exiting Fullscreen...');
    await evalCode(ws, `
      (() => {
        const fsBtn = document.querySelector('button[aria-label="Toggle Fullscreen"]');
        if (fsBtn) fsBtn.click();
      })()
    `);
    await sleep(1500);
    console.log('Capturing verify_fullscreen_exited.png...');
    await capture(ws, 'verify_fullscreen_exited.png');

    // 6. Test timeline scrubbing
    console.log('Testing Timeline scrubbing...');
    await evalCode(ws, `
      (() => {
        const slider = document.querySelector('input[type="range"]');
        if (slider) {
          slider.value = '65';
          slider.dispatchEvent(new Event('input', { bubbles: true }));
          slider.dispatchEvent(new Event('change', { bubbles: true }));
        }
      })()
    `);
    await sleep(1000);
    console.log('Capturing verify_timeline_scrub.png...');
    await capture(ws, 'verify_timeline_scrub.png');

    // 7. Zoom in to inspect building architecture
    console.log('Testing deep architectural zoom...');
    await evalCode(ws, `
      (() => {
        const zoomInBtn = document.querySelector('button[aria-label="Zoom In 3D Camera"]');
        if (zoomInBtn) {
          for (let i = 0; i < 7; i++) {
            zoomInBtn.click();
          }
        }
      })()
    `);
    await sleep(1500);
    console.log('Capturing verify_building_zoom_lifecycle.png...');
    await capture(ws, 'verify_building_zoom_lifecycle.png');

    ws.close();
  } finally {
    chrome.kill();
    console.log('Finished verification run.');
  }
}

main().catch(err => {
  console.error('Error during verification:', err);
  process.exit(1);
});
