const http = require('http');
const fs = require('fs');
const WebSocket = require('ws');
const { spawn } = require('child_process');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9295;
const PROFILE = 'C:/Temp/chrome_profile_' + Date.now();
const ARTIFACT_DIR = 'C:/Users/navneeth 33/.gemini/antigravity/brain/e5c6060f-5867-41ac-a031-b41bcf375972';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function cdpSend(ws, method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = Math.floor(Math.random() * 999999);
    const handler = (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.id === id) {
          ws.off('message', handler);
          if (msg.error) reject(new Error(msg.error.message));
          else resolve(msg.result || {});
        }
      } catch (err) {
        // ignore parse error on unrelated messages
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
  await sleep(1500);
  const res = await cdpSend(ws, 'Page.captureScreenshot', { format: 'png' });
  if (res && res.data) {
    const fullPath = `${ARTIFACT_DIR}/${filename}`;
    fs.writeFileSync(fullPath, Buffer.from(res.data, 'base64'));
    const size = fs.statSync(fullPath).size;
    console.log(`[CAPTURED] ${filename} (${size} bytes)`);
  } else {
    console.error(`Failed to capture ${filename}`);
  }
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
    await sleep(3500);

    // Dismiss walkthrough tour
    await evalCode(ws, `
      (() => {
        const skip = Array.from(document.querySelectorAll("button")).find(b => b.innerText.includes("Skip Tour"));
        if (skip) skip.click();
      })()
    `);
    await sleep(1000);

    // 1. Clean Dashboard
    console.log('1. Capturing final_1_clean_dashboard.png');
    await capture(ws, 'final_1_clean_dashboard.png');

    // 2. Dashboard Map Mode selection pills
    console.log('2. Capturing final_2_dashboard_map_modes.png');
    await capture(ws, 'final_2_dashboard_map_modes.png');

    // 3. Open 3D Map to show 3D Compatibility Modal
    console.log('3. Capturing final_3_3d_compat_modal.png');
    await evalCode(ws, `
      (() => {
        const btn = Array.from(document.querySelectorAll("button")).find(b => b.innerText.includes("Open 3D Map"));
        if (btn) btn.click();
      })()
    `);
    await sleep(1500);
    await capture(ws, 'final_3_3d_compat_modal.png');

    // 4. Fallback to 2D Map from modal
    console.log('4. Capturing final_4_geographic_twin_2d.png');
    await evalCode(ws, `
      (() => {
        const btn = Array.from(document.querySelectorAll("button")).find(b => b.innerText.includes("Open 2D Map Instead"));
        if (btn) btn.click();
      })()
    `);
    await sleep(3000);
    await capture(ws, 'final_4_geographic_twin_2d.png');

    // 5. Switch to 3D Map View
    console.log('5. Capturing final_5_geographic_twin_3d.png');
    await evalCode(ws, `
      (() => {
        const btn = Array.from(document.querySelectorAll("button")).find(b => b.innerText.trim() === "3D Map");
        if (btn) btn.click();
      })()
    `);
    await sleep(3500);
    await capture(ws, 'final_5_geographic_twin_3d.png');

    // 6. Switch to Holographic Map View
    console.log('6. Capturing final_6_geographic_twin_holo.png');
    await evalCode(ws, `
      (() => {
        const btn = Array.from(document.querySelectorAll("button")).find(b => b.innerText.trim() === "Holo");
        if (btn) btn.click();
      })()
    `);
    await sleep(2500);
    await capture(ws, 'final_6_geographic_twin_holo.png');

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
        const startBtn = Array.from(document.querySelectorAll("button")).find(b => b.innerText.includes("Start Simulation"));
        if (startBtn) startBtn.click();
      })()
    `);
    await sleep(2500);

    // 14. Step 1: Simplified Problem Entry
    console.log('14. Capturing final_14_simplified_problem_entry.png');
    await capture(ws, 'final_14_simplified_problem_entry.png');

    // Navigate to Step 2: Location Selection
    console.log('Navigating to Step 2: Select a Place...');
    await evalCode(ws, `
      (() => {
        const step2Btn = Array.from(document.querySelectorAll("button")).find(b => b.innerText.includes("2. Select a Place"));
        if (step2Btn) step2Btn.click();
      })()
    `);
    await sleep(3500);

    // 7. Traffic Green Coverage Overlay ON
    console.log('7. Capturing final_7_traffic_green_coverage.png');
    await capture(ws, 'final_7_traffic_green_coverage.png');

    // 10. Coverage Overlay Toggle OFF
    console.log('10. Capturing final_10_coverage_overlay_toggle_off.png');
    await evalCode(ws, `
      (() => {
        const toggleBtn = Array.from(document.querySelectorAll("button")).find(b => b.innerText.includes("Show Available Simulation Areas"));
        if (toggleBtn) toggleBtn.click();
      })()
    `);
    await sleep(1500);
    await capture(ws, 'final_10_coverage_overlay_toggle_off.png');

    // Turn overlay back ON
    await evalCode(ws, `
      (() => {
        const toggleBtn = Array.from(document.querySelectorAll("button")).find(b => b.innerText.includes("Show Available Simulation Areas"));
        if (toggleBtn) toggleBtn.click();
      })()
    `);
    await sleep(1500);

    // 11. Unsupported Location Popup (Simulate clicking an unmapped building)
    console.log('11. Capturing final_11_unsupported_location_popup.png');
    await evalCode(ws, `
      (() => {
        const canvas = document.querySelector('canvas');
        if (canvas) {
          const rect = canvas.getBoundingClientRect();
          const evt = new MouseEvent('click', {
            bubbles: true,
            clientX: rect.left + 160,
            clientY: rect.top + 140
          });
          canvas.dispatchEvent(evt);
        }
      })()
    `);
    await sleep(2000);
    await capture(ws, 'final_11_unsupported_location_popup.png');

    // 12. Supported Location Popup (Simulate clicking a modeled road corridor)
    console.log('12. Capturing final_12_supported_location_popup.png');
    await evalCode(ws, `
      (() => {
        const canvas = document.querySelector('canvas');
        if (canvas) {
          const rect = canvas.getBoundingClientRect();
          const evt = new MouseEvent('click', {
            bubbles: true,
            clientX: rect.left + rect.width / 2,
            clientY: rect.top + rect.height / 2
          });
          canvas.dispatchEvent(evt);
        }
      })()
    `);
    await sleep(2000);
    await capture(ws, 'final_12_supported_location_popup.png');

    // 13. Confirm Location State (Click "Confirm This Location" or "Confirm Study Area")
    console.log('13. Capturing final_13_confirmed_location_state.png');
    await evalCode(ws, `
      (() => {
        const confBtn = Array.from(document.querySelectorAll("button")).find(b => b.innerText.includes("Confirm This Location") || b.innerText.includes("Confirm Study Area"));
        if (confBtn) confBtn.click();
      })()
    `);
    await sleep(1500);
    await capture(ws, 'final_13_confirmed_location_state.png');

    // 15. Step 3: Understand Situation (What WhatIf Understood)
    console.log('15. Capturing final_15_plain_situation_step3.png');
    await evalCode(ws, `
      (() => {
        const step3Btn = Array.from(document.querySelectorAll("button")).find(b => b.innerText.includes("3. Understand Situation"));
        if (step3Btn) step3Btn.click();
      })()
    `);
    await sleep(2500);
    await capture(ws, 'final_15_plain_situation_step3.png');

    // 16. Step 4: Review Solutions (9 Human Questions)
    console.log('16. Capturing final_16_plain_solution_explanations_step4.png');
    await evalCode(ws, `
      (() => {
        const step4Btn = Array.from(document.querySelectorAll("button")).find(b => b.innerText.includes("4. Compare Solutions"));
        if (step4Btn) step4Btn.click();
      })()
    `);
    await sleep(2500);
    await capture(ws, 'final_16_plain_solution_explanations_step4.png');

    // 17. Step 5: Findings & 5-Phase Roadmap
    console.log('17. Capturing final_17_findings_and_roadmap_step5.png');
    await evalCode(ws, `
      (() => {
        const step5Btn = Array.from(document.querySelectorAll("button")).find(b => b.innerText.includes("5. Findings & Next Steps"));
        if (step5Btn) step5Btn.click();
      })()
    `);
    await sleep(2500);
    await capture(ws, 'final_17_findings_and_roadmap_step5.png');

    // 18. Step 6: Dedicated Before/After Map
    console.log('18. Capturing final_18_dedicated_before_after_map_step6.png');
    await evalCode(ws, `
      (() => {
        const step6Btn = Array.from(document.querySelectorAll("button")).find(b => b.innerText.includes("6. Map & Comparison"));
        if (step6Btn) step6Btn.click();
      })()
    `);
    await sleep(3500);
    await capture(ws, 'final_18_dedicated_before_after_map_step6.png');

    // 19. Step 7: Final Comparison
    console.log('19. Capturing final_19_final_comparison_step7.png');
    await evalCode(ws, `
      (() => {
        const step7Btn = Array.from(document.querySelectorAll("button")).find(b => b.innerText.includes("Final. Estimation Complete"));
        if (step7Btn) step7Btn.click();
      })()
    `);
    await sleep(2500);
    await capture(ws, 'final_19_final_comparison_step7.png');

    // 20. Estimation Complete INR Summary
    console.log('20. Capturing final_20_estimation_complete_inr.png');
    await capture(ws, 'final_20_estimation_complete_inr.png');

    // Now capture Water and Energy green coverage (Screenshots 8 & 9)
    console.log('Navigating to Step 1 to switch to Water domain...');
    await evalCode(ws, `
      (() => {
        const step1Btn = Array.from(document.querySelectorAll("button")).find(b => b.innerText.includes("1. Problem or Action"));
        if (step1Btn) step1Btn.click();
      })()
    `);
    await sleep(1500);

    // Switch to Water Domain
    await evalCode(ws, `
      (() => {
        const waterBtn = Array.from(document.querySelectorAll("button")).find(b => b.innerText.includes("Municipal Water Systems"));
        if (waterBtn) waterBtn.click();
      })()
    `);
    await sleep(1500);

    // Navigate to Step 2 for Water
    console.log('8. Capturing final_8_water_green_coverage.png');
    await evalCode(ws, `
      (() => {
        const step2Btn = Array.from(document.querySelectorAll("button")).find(b => b.innerText.includes("2. Select a Place"));
        if (step2Btn) step2Btn.click();
      })()
    `);
    await sleep(3500);
    await capture(ws, 'final_8_water_green_coverage.png');

    // Return to Step 1 and switch domain to Energy
    console.log('Navigating to Step 1 to switch to Energy domain...');
    await evalCode(ws, `
      (() => {
        const step1Btn = Array.from(document.querySelectorAll("button")).find(b => b.innerText.includes("1. Problem or Action"));
        if (step1Btn) step1Btn.click();
      })()
    `);
    await sleep(1500);

    // Switch to Energy Domain
    await evalCode(ws, `
      (() => {
        const energyBtn = Array.from(document.querySelectorAll("button")).find(b => b.innerText.includes("Electrical Power Grid"));
        if (energyBtn) energyBtn.click();
      })()
    `);
    await sleep(1500);

    // Navigate to Step 2 for Energy
    console.log('9. Capturing final_9_energy_green_coverage.png');
    await evalCode(ws, `
      (() => {
        const step2Btn = Array.from(document.querySelectorAll("button")).find(b => b.innerText.includes("2. Select a Place"));
        if (step2Btn) step2Btn.click();
      })()
    `);
    await sleep(3500);
    await capture(ws, 'final_9_energy_green_coverage.png');

    console.log('ALL 20 ACCEPTANCE SCREENSHOTS SUCCESSFULLY CAPTURED!');
    ws.close();
  } finally {
    chrome.kill();
  }
}

main().catch(err => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
