const http = require('http');
const fs = require('fs');
const WebSocket = require('ws');
const { spawn } = require('child_process');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9260;
const PROFILE = 'C:/Temp/chrome_final_refinements';
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
  await sleep(1000);
  const { data } = await cdpSend(ws, 'Page.captureScreenshot', { format: 'png' });
  const fullPath = `${ARTIFACT_DIR}/${filename}`;
  fs.writeFileSync(fullPath, Buffer.from(data, 'base64'));
  console.log(`[CAPTURED] ${filename}`);
}

async function main() {
  console.log('Launching headless Chrome on port ' + PORT);
  const chrome = spawn(CHROME, [
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${PROFILE}`,
    '--headless=new',
    '--no-sandbox',
    '--window-size=1800,1100',
    'about:blank'
  ]);

  try {
    await sleep(2500);
    const tabs = await new Promise((resolve) => {
      http.get(`http://localhost:${PORT}/json`, res => {
        let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(JSON.parse(d)));
      });
    });

    const ws = new WebSocket(tabs[0].webSocketDebuggerUrl);
    await new Promise(r => ws.on('open', r));

    await cdpSend(ws, 'Runtime.enable');
    await cdpSend(ws, 'Page.enable');

    console.log('Navigating to http://localhost:3000...');
    await cdpSend(ws, 'Page.navigate', { url: 'http://localhost:3000' });
    await sleep(2500);

    // Reset storage to guarantee clean state
    await evalCode(ws, `
      localStorage.setItem("whatif_walkthrough_seen", "true");
      localStorage.removeItem("whatif_dont_show_3d_compat");
      sessionStorage.removeItem("whatif_seen_3d_compat");
      location.reload();
    `);
    await sleep(2500);

    // 1. Dashboard with 3 Map Mode Pills
    console.log('1. Dashboard Map Pills');
    await capture(ws, 'final_1_dashboard_map_pills.png');

    // 2. Click 3D Map option on card to open Compatibility Modal
    console.log('2. Opening 3D Map Compatibility Modal');
    await evalCode(ws, `
      (() => {
        const btn = Array.from(document.querySelectorAll("button")).find(b => b.innerText.includes("3D Map") && b.closest('.bg-gradient-to-br'));
        if (btn) btn.click();
        else {
          const mapBtn = Array.from(document.querySelectorAll("button")).find(b => b.innerText.includes("Explore Digital Twin Map"));
          if (mapBtn) mapBtn.click();
        }
      })()
    `);
    await sleep(1500);
    await capture(ws, 'final_2_3d_compat_modal.png');

    // 3. Continue to 3D Map
    console.log('3. Continuing to 3D Geographic Twin Map');
    await evalCode(ws, `
      (() => {
        const btn = Array.from(document.querySelectorAll("button")).find(b => b.innerText.includes("Continue to 3D Map"));
        if (btn) btn.click();
      })()
    `);
    await sleep(3500);
    await capture(ws, 'final_3_geographic_twin_3d.png');

    // 4. Switch to 2D Map
    console.log('4. Switching to 2D Map View');
    await evalCode(ws, `
      (() => {
        const btn = Array.from(document.querySelectorAll("button")).find(b => b.innerText.trim() === "2D Map");
        if (btn) btn.click();
      })()
    `);
    await sleep(2000);
    await capture(ws, 'final_4_geographic_twin_2d.png');

    // Return to Dashboard and open Simulation Workspace
    console.log('Returning to Dashboard...');
    await evalCode(ws, `
      (() => {
        const backBtn = Array.from(document.querySelectorAll("button")).find(b => b.innerText.includes("Back to Dashboard"));
        if (backBtn) backBtn.click();
      })()
    `);
    await sleep(1500);

    console.log('Opening Simulation Workspace...');
    await evalCode(ws, `
      (() => {
        const simBtn = Array.from(document.querySelectorAll("button")).find(b => b.innerText.includes("Open Simulation Workspace") || b.innerText.includes("Start Problem-Solving Journey"));
        if (simBtn) simBtn.click();
      })()
    `);
    await sleep(2000);

    // 5. Step 1: Action-First INR Mode
    console.log('5. Step 1 Action-First Mode');
    await evalCode(ws, `
      (() => {
        const btn = Array.from(document.querySelectorAll("button")).find(b => b.innerText.includes("Describe an Action") || b.innerText.includes("Describe Action"));
        if (btn) btn.click();
      })()
    `);
    await sleep(1500);
    await capture(ws, 'final_5_step1_action_first_inr.png');

    // 6. Step 1: Problem Catalog
    console.log('6. Step 1 Problem Catalog');
    await evalCode(ws, `
      (() => {
        const btn = Array.from(document.querySelectorAll("button")).find(b => b.innerText.includes("Select Known Issue") || b.innerText.includes("Known Problem"));
        if (btn) btn.click();
      })()
    `);
    await sleep(1500);
    await capture(ws, 'final_6_step1_problem_catalog.png');

    // 7. Step 2: Select a Place (Domain Coverage Valid)
    console.log('7. Step 2 Location Selection (Valid)');
    await evalCode(ws, `
      (() => {
        const step2Btn = Array.from(document.querySelectorAll("button")).find(b => b.innerText.includes("2. Select a Place") || b.innerText.includes("Select a Place"));
        if (step2Btn) step2Btn.click();
      })()
    `);
    await sleep(2500);
    await capture(ws, 'final_7_step2_domain_coverage_valid.png');

    // 8. Step 2: Domain Coverage Unsupported (show polite banner)
    console.log('8. Step 2 Domain Coverage Unsupported Banner');
    await evalCode(ws, `
      (() => {
        // Trigger unsupported feature selection test banner if available or simulate feature selection
        const canvas = document.querySelector('canvas');
        if (canvas) {
          // dispatch click on canvas to trigger selection
          const evt = new MouseEvent('click', {
            bubbles: true,
            clientX: canvas.getBoundingClientRect().left + 150,
            clientY: canvas.getBoundingClientRect().top + 150
          });
          canvas.dispatchEvent(evt);
        }
      })()
    `);
    await sleep(1500);
    await capture(ws, 'final_8_step2_domain_coverage_unsupported.png');

    // 9. Step 3: Understand Situation (with collapsed technical details)
    console.log('9. Step 3 Understand Situation');
    await evalCode(ws, `
      (() => {
        const step3Btn = Array.from(document.querySelectorAll("button")).find(b => b.innerText.includes("3. Understand Situation") || b.innerText.includes("Understand Situation"));
        if (step3Btn) step3Btn.click();
      })()
    `);
    await sleep(2000);
    await capture(ws, 'final_9_step3_plain_situation_collapsed_tech.png');

    // 10. Step 4: Compare Solutions (answering the 8 Human Questions)
    console.log('10. Step 4 Solutions Answering 8 Human Questions');
    await evalCode(ws, `
      (() => {
        const step4Btn = Array.from(document.querySelectorAll("button")).find(b => b.innerText.includes("4. Compare Solutions") || b.innerText.includes("Compare Solutions"));
        if (step4Btn) step4Btn.click();
      })()
    `);
    await sleep(2500);
    await capture(ws, 'final_10_step4_solution_8_questions.png');

    // 11. Step 5: Findings & Next Steps (10 Comparison Questions)
    console.log('11. Step 5 Comparison 10 Questions');
    await evalCode(ws, `
      (() => {
        const step5Btn = Array.from(document.querySelectorAll("button")).find(b => b.innerText.includes("5. Findings & Next Steps") || b.innerText.includes("Findings & Next Steps"));
        if (step5Btn) step5Btn.click();
      })()
    `);
    await sleep(2500);
    await capture(ws, 'final_11_step5_comparison_10_questions.png');

    // 12. Step 6: Map & Comparison (Dedicated Before/After Map)
    console.log('12. Step 6 Map & Comparison');
    await evalCode(ws, `
      (() => {
        const step6Btn = Array.from(document.querySelectorAll("button")).find(b => b.innerText.includes("6. Map & Comparison") || b.innerText.includes("Map & Comparison"));
        if (step6Btn) step6Btn.click();
      })()
    `);
    await sleep(3000);
    await capture(ws, 'final_12_step6_dedicated_before_after_map.png');

    // 13. Step 7: Estimation Complete
    console.log('13. Step 7 Estimation Complete');
    await evalCode(ws, `
      (() => {
        const step7Btn = Array.from(document.querySelectorAll("button")).find(b => b.innerText.includes("Final. Estimation Complete") || b.innerText.includes("Estimation Complete"));
        if (step7Btn) step7Btn.click();
      })()
    `);
    await sleep(2000);
    await capture(ws, 'final_13_step7_estimation_complete_inr.png');

    // 14. Profile Settings Compatibility Toggle
    console.log('14. Profile Settings Modal');
    await evalCode(ws, `
      (() => {
        const settingsBtn = document.querySelector('button[aria-label="Open Settings"]') ||
          document.querySelector('button[title="Profile Settings"]') ||
          Array.from(document.querySelectorAll("button")).find(b => b.innerText.includes("Settings") || b.getAttribute('aria-label')?.includes('Profile'));
        if (settingsBtn) settingsBtn.click();
      })()
    `);
    await sleep(1500);
    await capture(ws, 'final_14_profile_settings_compat_toggle.png');

    console.log('All 14 acceptance screenshots successfully captured!');
    ws.close();
  } finally {
    chrome.kill();
  }
}

main().catch(err => {
  console.error('Fatal error during capture:', err);
  process.exit(1);
});
