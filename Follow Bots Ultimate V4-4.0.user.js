// ==UserScript==
// @name        Follow Bots Ultimate V4
// @namespace   Violentmonkey Scripts
// @match       *://arras.io/*
// @grant       none
// @version     4.0
// @author      🇻🇪🇨🇹
// @description All tabs need to be shown - with Mod Menu UI
// ==/UserScript==

// ============================================================
// MACRO DEFINITIONS
//
// upgrades (strings):
//   Each array entry runs in order. Use ";" for random alternatives.
//   e.g.  ["khkhe;khkye;ihyye"]   → picks one randomly
//         ["khkhe", "uiuke"]      → always khkhe, then uiuke
//
// skills — build format:
//   "[N1/N2/N3/N4/N5/N6/N7/N8/N9/N0]"
//   10 slash-separated values for stat keys 1,2,3,4,5,6,7,8,9,0 (in order).
//     N = 0  →  skip
//     N = 9  →  hold M + press that key once (instant max)
//     N = other → press that key N times, no M
//   Example: "[6/6/0/6/6/6/6/6/0/0]"
//   Example: "[1/1/9/0/0/0/0/0/0/0]"  → press 1 once, 2 once, M+3
//
// Example build:
// "My Build": {
//   strings: ["hykiec;hykjec"],
//   skills:  ["[6/6/0/6/6/6/6/6/0/0]"],
// },
// ============================================================

const MACROS = {
  "Octo": {
    strings: ["hykiec;hykjec;uiuke;khkhe;hykue;hiiy;hykyec;hyhyec"],
    skills: ["[0/0/3/9/9/9/9/3/0/0]"]
  },
  "One way": {
    strings: ["khkhe;khkye;ihyye;yuyje"],
    skills: ["[0/0/9/9/9/9/9/0/0/0]"]
  },
  "Octo + One way": {
    strings: ["khkhe;khkye;ihyye;yuyje;hykiec;hykjec;uiuke;hykue;hiiy;hykyec;hyhyec"],
    skills: ["[0/0/4/9/9/9/9/2/0/0]"]
  },
  "Boosters": {
    strings: ["huyye;huyue;huyie;huyhe;huyje;huyke;huuye;huuue;huuie;huuhe;huuje;huuke;huiye;huiue;huiie;huihe;huije;huike;huhye;huhue;huhie;huhhe;huhje;huhke;hujye;hujue;hujie;hujhe;hujje;hujke;hukye;hukue;hukie;hukhe;hukje;hukke"],
    skills: ["[2/2/0/0/0/0/9/9/0/9]"]
  },
  "Launcher": {
    strings: ["khkhe;khkye;khue"],
    skills: ["[0/0/9/9/9/9/9/0/0/0]"]
  },
  "Norm anni": {
    strings: ["kye;kyue;kyyve"],
    skills: ["[0/0/9/9/9/9/9/0/0/0]"]
  },
  "Assault ar": {
    strings: ["khkye;y,ye;hykjec"],
    skills: ["[0/0/3/9/9/9/3/0/0/0]"]
  },
  "Firework": {
    strings: ["khkye"],
    skills: ["[0/0/9/9/9/9/9/0/0/0]"]
  }
};

let lastMacroName = localStorage.getItem("lastMacroName") || "One way";


// Optimized console filtering with Set for O(1) lookups
const filteredStrings = new Set([
  "%cStop!",
  "%cHackers have been known to trick people into running malicious scripts here, which would give them full access to your account. Do not paste anything here, or you may lose access to your account.",
  "arras.io - build "
]);

// --- ORIGINAL METHODS CAPTURE ---
const originalWindowAddEventListener = window.addEventListener;
const originalDivAddEventListener = HTMLDivElement.prototype.addEventListener;
const originalStrokeText = CanvasRenderingContext2D.prototype.strokeText;
const originalConsoleLog = console.log;

console.log = function(...args) {
  const firstArg = args[0]?.toString();
  if (!firstArg) return originalConsoleLog.apply(this, args);

  for (const str of filteredStrings) {
    if (firstArg.includes(str)) return;
  }

  return originalConsoleLog.apply(this, args);
}


// Use requestAnimationFrame for polling
function setName() {
  const inputs = document.getElementsByTagName("input");
  if (inputs[0]) {
    inputs[0].value = "" + name;
    return true;
  }
  return false;
}

function pollForInput() {
  if (!setName()) {
    requestAnimationFrame(pollForInput);
  }
}
requestAnimationFrame(pollForInput);

// ============================================================
// CONFIG — edit these values freely
// ============================================================

const BASE_DIST_THRESHOLD = 4;      // default stop distance (game coord units)
const BASE_MOV_THRESHOLD  = 1.75;   // deadzone for movement jitter
let   followDistanceUnits  = BASE_DIST_THRESHOLD; // driven by slider; shared via localStorage
let   mouseFollowScale     = 60;   // how many game units = one screen-width. (Only what it starts with, adjustable ingame via slider.)
localStorage.setItem("mouseFollowScale", mouseFollowScale); // seed for bot tabs
let   names                = [""];   // bot names (random pick)
let   name                 = names[Math.floor(Math.random() * names.length)];

// Slot keys in order for the build format [N1/N2/.../N10]
const SKILL_SLOT_KEYS = ["1","2","3","4","5","6","7","8","9","0"];

// Expands skills array into flat key-press list.
// Each item: { mHeld: bool, key: "Digit#" }
function expandSkillSteps(skills) {
    const presses = [];
    for (const step of skills) {
        if (typeof step !== "string") continue;
        const match = step.match(/\[([0-9/]+)\]/);
        if (!match) continue;
        const values = match[1].split("/").map(Number);
        for (let i = 0; i < values.length && i < SKILL_SLOT_KEYS.length; i++) {
            const val = values[i];
            if (val === 0) continue;
            const key = "Digit" + SKILL_SLOT_KEYS[i];
            if (val === 9) {
                presses.push({ mHeld: true, key });
            } else {
                for (let j = 0; j < val; j++) {
                    presses.push({ mHeld: false, key });
                }
            }
        }
    }
    return presses;
}

// ============================================================
// STATE — internal, don't touch
// ============================================================

let isParent = false;
let isEnabled = false;
let ingame = false;
let uiVisible = false; // Hidden by default, toggle with ESC
let autoRespawnEnabled = false;
let autoUpgradeOnRespawn = false;
let respawnCooldown = false;
let isMovementBlocked = false;
let mouseFollowEnabled = false;

// Master controller tracking
let isMasterController = false;
let myMasterId = null;

// Key tracking
const mirroredKeyStates = new Map();
const pendingKeyPresses = new Map();

// Movement keys that are NOT mirrored by default (unless mirroring is on)
const MOVEMENT_KEYS = new Set(["KeyW", "KeyA", "KeyS", "KeyD"]);

// Mouse click handling to prevent lag
let mouseButtonStates = {
  left: { pressed: false, lastChange: 0 },
  middle: { pressed: false, lastChange: 0 },
  right: { pressed: false, lastChange: 0 }
};
const MOUSE_BUTTONS = ["left", "middle", "right"];
const MIN_MOUSE_HOLD_TIME = 50; // Minimum time between mouse state changes

// Upgrade Sequence Constants
const UPGRADE_STRINGS = ["hykiec", "hykjec", "uiuke", "khkhe", "hykue", "hiiy", "hykyec", "hyhyec"];

// Track all active WebSocket instances so we can close them all at once
const activeWebSockets = new Set();

function disconnectAll() {
  for (const sock of activeWebSockets) {
    try { sock.close(); } catch (e) {}
  }
  activeWebSockets.clear();
  console.log("[FollowBots] All WebSockets disconnected.");
}

class ws extends window.WebSocket {
  constructor(...args) {
    super(...args);
    activeWebSockets.add(this);
    // Remove from tracking when the socket closes on its own
    this.addEventListener("close", () => activeWebSockets.delete(this));
    this.addEventListener("message", (e) => {
      if (ingame) return;
      keyEvent("KeyL", true);
      keyEvent("KeyL", false);
      ingame = true;
    }, { once: true });
  }
}
window.WebSocket = ws;

let currentParentState = null; // To store parent data for strokeText access

let player = {
  x: 0,
  y: 0,
  inputs: {
    left: false,
    middle: false,
    right: false,
    mouseX: 0,
    mouseY: 0,
    mouseWorldX: 0, // World-space mouse X (parent computes and sends)
    mouseWorldY: 0, // World-space mouse Y (parent computes and sends)
    mouseFollow: false, // Whether bots should follow mouse instead of parent position
    autoRespawn: false, // Parent sends this
    autoUpgrade: false, // Parent sends this
    special: {}, // Will store ALL non-movement keys dynamically
    wasd: {},     // Will store WASD/QZ keys only when mirroring is enabled
    lastMacro: lastMacroName
  }
};

// Constants
const ARROW_KEYS = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);

// --- UI COMPONENTS ---
const uiContainer = document.createElement("div");
Object.assign(uiContainer.style, {
  position: "fixed",
  zIndex: "999999",
  left: "50%",
  top: "50%",
  transform: "translate(-50%, -50%)",
  width: "600px", // Wider
  backgroundColor: "#1a1a1a",
  color: "#fff",
  fontFamily: "Segoe UI, Roboto, Helvetica, Arial, sans-serif",
  fontSize: "14px",
  borderRadius: "8px",
  boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
  display: "none", // Hidden initially
  flexDirection: "column",
  overflow: "hidden",
  border: "1px solid #333"
});

const uiHeader = document.createElement("div");
Object.assign(uiHeader.style, {
  padding: "10px 15px",
  backgroundColor: "#252525",
  borderBottom: "1px solid #333",
  fontWeight: "bold",
  fontSize: "16px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center"
});
uiHeader.textContent = "FollowBots Ultimate Menu";

const closeBtn = document.createElement("span");
closeBtn.innerHTML = "&times;";
closeBtn.style.cursor = "pointer";
closeBtn.style.fontSize = "20px";
closeBtn.onclick = () => { uiVisible = false; uiContainer.style.display = "none"; };
uiHeader.appendChild(closeBtn);
uiContainer.appendChild(uiHeader);

// Tab Navigation
const tabHeader = document.createElement("div");
Object.assign(tabHeader.style, {
    display: "flex",
    backgroundColor: "#222",
    borderBottom: "1px solid #333"
});

const tabs = ["Main", "Macros"];
const tabButtons = {};

tabs.forEach(tabName => {
    const btn = document.createElement("div");
    btn.textContent = tabName;
    Object.assign(btn.style, {
        padding: "10px 20px",
        cursor: "pointer",
        color: "#888",
        borderBottom: "2px solid transparent",
        transition: "0.2s"
    });
    btn.onclick = () => switchTab(tabName);
    tabHeader.appendChild(btn);
    tabButtons[tabName] = btn;
});
uiContainer.appendChild(tabHeader);

const uiBody = document.createElement("div");
Object.assign(uiBody.style, {
  padding: "15px",
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "15px",
  maxHeight: "80vh",
  overflowY: "auto"
});
uiContainer.appendChild(uiBody);

const mainTabContent = document.createElement("div");
mainTabContent.style.display = "contents"; // Allows the grid layout of uiBody to apply to children
const macrosTabContent = document.createElement("div");
macrosTabContent.style.display = "contents";

function switchTab(name) {
    tabs.forEach(t => {
        tabButtons[t].style.color = "#888";
        tabButtons[t].style.borderBottomColor = "transparent";
        tabButtons[t].style.backgroundColor = "transparent";
    });
    tabButtons[name].style.color = "#fff";
    tabButtons[name].style.borderBottomColor = "#2196F3";
    tabButtons[name].style.backgroundColor = "#2a2a2a";

    if (name === "Main") {
        uiBody.style.display = "grid";
        mainTabContent.style.display = "contents";
        macrosTabContent.style.display = "none";
    } else {
        uiBody.style.display = "flex";
        uiBody.style.flexDirection = "column";
        mainTabContent.style.display = "none";
        macrosTabContent.style.display = "flex";
        macrosTabContent.style.flexDirection = "column";
    }
}
// Initial addition to body
uiBody.appendChild(mainTabContent);
uiBody.appendChild(macrosTabContent);

// Helper for UI Rows
function createRow(child) {
    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.alignItems = "center";
    row.style.justifyContent = "space-between";
    row.style.marginBottom = "5px";
    if (child) row.appendChild(child);
    return row;
}

function createSectionTitle(text) {
    const el = document.createElement("div");
    el.textContent = text;
    el.style.color = "#888";
    el.style.fontSize = "11px";
    el.style.textTransform = "uppercase";
    el.style.fontWeight = "bold";
    el.style.marginTop = "0"; // Reset top margin
    el.style.marginBottom = "5px";
    el.style.borderBottom = "1px solid #333";
    el.style.paddingBottom = "2px";
    el.style.gridColumn = "1 / -1"; // Spans full width
    return el;
}

function createToggle(label, initialState, onChange) {
    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.justifyContent = "space-between";
    row.style.alignItems = "center";
    row.style.padding = "5px 0";

    const labelSpan = document.createElement("span");
    labelSpan.textContent = label;

    const switchLabel = document.createElement("label");
    switchLabel.style.position = "relative";
    switchLabel.style.display = "inline-block";
    switchLabel.style.width = "40px";
    switchLabel.style.height = "20px";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = initialState;
    input.style.opacity = "0";
    input.style.width = "0";
    input.style.height = "0";

    const slider = document.createElement("span");
    slider.style.position = "absolute";
    slider.style.cursor = "pointer";
    slider.style.top = "0";
    slider.style.left = "0";
    slider.style.right = "0";
    slider.style.bottom = "0";
    slider.style.backgroundColor = "#ccc";
    slider.style.transition = ".4s";
    slider.style.borderRadius = "34px";

    // Toggle Circle
    const circle = document.createElement("span");
    circle.style.position = "absolute";
    circle.style.content = "";
    circle.style.height = "16px";
    circle.style.width = "16px";
    circle.style.left = "2px";
    circle.style.bottom = "2px";
    circle.style.backgroundColor = "white";
    circle.style.transition = ".4s";
    circle.style.borderRadius = "50%";

    slider.appendChild(circle);
    switchLabel.appendChild(input);
    switchLabel.appendChild(slider);

    // Logic to visually update
    function updateVisuals() {
        if (input.checked) {
            slider.style.backgroundColor = "#2196F3";
            circle.style.transform = "translateX(20px)";
        } else {
            slider.style.backgroundColor = "#ccc";
            circle.style.transform = "translateX(0px)";
        }
    }
    updateVisuals();

    input.onchange = (e) => {
        updateVisuals();
        onChange(e.target.checked);
    };

    row.appendChild(labelSpan);
    row.appendChild(switchLabel);

    return { element: row, setChecked: (v) => { input.checked = v; updateVisuals(); } };
}

function createActionButton(text, color, onClick) {
    const btn = document.createElement("button");
    btn.textContent = text;
    Object.assign(btn.style, {
        width: "100%",
        padding: "8px",
        backgroundColor: color || "#333",
        border: "none",
        color: "white",
        borderRadius: "4px",
        cursor: "pointer",
        fontWeight: "bold",
        marginTop: "5px"
    });
    btn.onmouseenter = () => btn.style.filter = "brightness(1.1)";
    btn.onmouseleave = () => btn.style.filter = "none";
    btn.onclick = onClick;
    return btn;
}

function createTextInput(placeholder, initial, onChange) {
    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = placeholder;
    input.value = initial;
    Object.assign(input.style, {
        width: "100%",
        padding: "6px",
        backgroundColor: "#333",
        border: "1px solid #444",
        color: "white",
        borderRadius: "4px",
        margin: "2px 0",
        boxSizing: "border-box"
    });
    input.oninput = (e) => onChange(e.target.value);
    return input;
}

function createSliderInput(min, max, val, suffix, onChange) {
    const container = document.createElement("div");
    container.style.padding = "5px 0";

    const labelRow = document.createElement("div");
    labelRow.style.display = "flex";
    labelRow.style.justifyContent = "space-between";
    labelRow.style.fontSize = "12px";
    labelRow.innerHTML = `<span>Delay</span><span>${val}${suffix}</span>`;

    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = min;
    slider.max = max;
    slider.value = val;
    slider.style.width = "100%";

    slider.oninput = (e) => {
        labelRow.lastChild.textContent = e.target.value + suffix;
        onChange(Number(e.target.value));
    };

    container.appendChild(labelRow);
    container.appendChild(slider);
    return container;
}

mainTabContent.appendChild(createSectionTitle("Bot Controls"));
const leftCol = document.createElement("div");
leftCol.style.display = "flex";
leftCol.style.flexDirection = "column";
leftCol.style.gap = "5px";

const rightCol = document.createElement("div");
rightCol.style.display = "flex";
rightCol.style.flexDirection = "column";
rightCol.style.gap = "5px";

mainTabContent.appendChild(leftCol);
mainTabContent.appendChild(rightCol);

// Left Column Content
const toggleParent = createToggle("Parent Mode", isParent, (v) => {
    isParent = v;
    if (isParent) isEnabled = true;
    updateToggles();
});
leftCol.appendChild(toggleParent.element);

const toggleEnabled = createToggle("Enabled", isEnabled, (v) => {
    isEnabled = v;
    if (!isEnabled && isParent) try { localStorage.removeItem("parent"); } catch(e){}
    if (!isEnabled && !isParent) releaseAllKeys();
});
leftCol.appendChild(toggleEnabled.element);

const btnMaster = createActionButton("Master Mode", "#4CAF50", () => {
    const masterId = "master_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
    isMasterController = true;
    isParent = true;
    isEnabled = true;
    myMasterId = masterId;
    localStorage.setItem("masterControl", JSON.stringify({ masterId: masterId, timestamp: Date.now() }));
    updateToggles();
});
leftCol.appendChild(btnMaster);

leftCol.appendChild(createSectionTitle("Input Settings"));
const toggleMirror = createToggle("Mirror All Inputs", localStorage.getItem("mirrorAllInputs") === "true", (v) => {
    localStorage.setItem("mirrorAllInputs", v.toString());
});
leftCol.appendChild(toggleMirror.element);

const toggleMouse = createToggle("Mouse", localStorage.getItem("mouseMirroring") === "true", (v) => {
    localStorage.setItem("mouseMirroring", v.toString());
});
leftCol.appendChild(toggleMouse.element);

const toggleBetterAim = createToggle("Better Aim", localStorage.getItem("betterAim") === "true", (v) => {
    localStorage.setItem("betterAim", v.toString());
});
leftCol.appendChild(toggleBetterAim.element);

const toggleMov = createToggle("Bot Movement", localStorage.getItem("disableMovement") !== "true", (v) => {
    localStorage.setItem("disableMovement", (!v).toString());
});
leftCol.appendChild(toggleMov.element);

const toggleMouseFollow = createToggle("Mouse Follow", mouseFollowEnabled, (v) => {
    mouseFollowEnabled = v;
    player.inputs.mouseFollow = v;
});
leftCol.appendChild(toggleMouseFollow.element);


// Right Column Content
rightCol.appendChild(createSectionTitle("Auto Respawn (Parent Controls)"));
const toggleRespawn = createToggle("Enable Auto Respawn", autoRespawnEnabled, (v) => {
    autoRespawnEnabled = v;
    player.inputs.autoRespawn = v;
});
rightCol.appendChild(toggleRespawn.element);

const toggleUpgradeRespawn = createToggle("Upgrade On Respawn", autoUpgradeOnRespawn, (v) => {
    autoUpgradeOnRespawn = v;
    player.inputs.autoUpgrade = v;
});
rightCol.appendChild(toggleUpgradeRespawn.element);

rightCol.appendChild(createSectionTitle("Follow Settings"));

const togglePathFollow = createToggle("Path Follow", localStorage.getItem("pathFollow") === "true", (v) => {
    localStorage.setItem("pathFollow", v.toString());
});
rightCol.appendChild(togglePathFollow.element);

function createFollowDistanceSlider() {
    const container = document.createElement("div");
    container.style.padding = "5px 0";

    const labelRow = document.createElement("div");
    labelRow.style.display = "flex";
    labelRow.style.justifyContent = "space-between";
    labelRow.style.fontSize = "12px";
    // Show actual coord units; default is BASE_DIST_THRESHOLD (4)
    labelRow.innerHTML = `<span>Stop Distance</span><span>${BASE_DIST_THRESHOLD} units</span>`;

    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = 0;    // 0 = hug tightly
    slider.max = 50;   // 50 coord units away
    slider.step = 1;
    slider.value = BASE_DIST_THRESHOLD; // Default = 4 units
    slider.style.width = "100%";

    slider.oninput = (e) => {
        const units = Number(e.target.value);
        followDistanceUnits = units;
        // Broadcast to bot tabs via localStorage
        localStorage.setItem("followDistanceUnits", units);
        labelRow.lastChild.textContent = units + " units";
    };

    container.appendChild(labelRow);
    container.appendChild(slider);
    return container;
}

rightCol.appendChild(createFollowDistanceSlider());

// Mouse Follow Scale slider
function createMouseFollowScaleSlider() {
    const container = document.createElement("div");
    container.style.padding = "5px 0";

    const labelRow = document.createElement("div");
    labelRow.style.display = "flex";
    labelRow.style.justifyContent = "space-between";
    labelRow.style.fontSize = "12px";
    labelRow.innerHTML = `<span>Mouse Scale</span><span>${mouseFollowScale}</span>`;

    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = 20;
    slider.max = 300;
    slider.step = 5;
    slider.value = mouseFollowScale;
    slider.style.width = "100%";

    slider.oninput = (e) => {
        mouseFollowScale = Number(e.target.value);
        localStorage.setItem("mouseFollowScale", mouseFollowScale);
        labelRow.lastChild.textContent = mouseFollowScale;
    };

    container.appendChild(labelRow);
    container.appendChild(slider);
    return container;
}

rightCol.appendChild(createMouseFollowScaleSlider());

rightCol.appendChild(createSectionTitle("Connection"));
const disconnectBtn = createActionButton("⚡ Disconnect All", "#c0392b", () => {
    // Broadcast to all other tabs via localStorage
    const cmd = { type: 'disconnect', timestamp: Date.now(), id: Math.random() };
    localStorage.setItem("botCommand", JSON.stringify(cmd));
});
rightCol.appendChild(disconnectBtn);

// --- Macros Tab Content ---
macrosTabContent.appendChild(createSectionTitle("Available Macros"));
const macroGrid = document.createElement("div");
macroGrid.style.display = "grid";
macroGrid.style.gridTemplateColumns = "1fr 1fr";
macroGrid.style.gap = "10px";

const lastMacroLabel = document.createElement("div");
lastMacroLabel.style.marginTop = "15px";
lastMacroLabel.style.fontSize = "12px";
lastMacroLabel.style.color = "#aaa";
lastMacroLabel.textContent = "Last Used: " + lastMacroName;

Object.keys(MACROS).forEach(name => {
    const btn = createActionButton(name, "#2196F3", () => {
        lastMacroName = name;
        localStorage.setItem("lastMacroName", name);
        player.inputs.lastMacro = name;
        lastMacroLabel.textContent = "Last Used: " + name;

        const command = { type: 'upgrade', macro: name, timestamp: Date.now(), id: Math.random() };
        localStorage.setItem("botCommand", JSON.stringify(command));
        console.log("Sent macro command:", name);
    });
    macroGrid.appendChild(btn);
});

macrosTabContent.appendChild(macroGrid);
macrosTabContent.appendChild(lastMacroLabel);

// Initialize with Main tab
switchTab("Main");

document.body.appendChild(uiContainer);

function updateToggles() {
    toggleParent.setChecked(isParent);
    toggleEnabled.setChecked(isEnabled);
    toggleMaster.setChecked(isMasterController);
}

// --- LOGIC FROM UPGRADE SCRIPT ---

// Intercept keyboard events - FIXED to track ALL non-movement keys
window.addEventListener = function(...args) {
  let type = args[0];
  if (type === "keydown" || type === "keyup") {
    let callback = args[1];

    args[1] = function(...params) {
      let keyReq = {
        isTrusted: true,
        key: params[0].key,
        code: params[0].code,
        preventDefault: function(){}
      };

      // Stop Escape from propagating if UI is being toggled?
      // Actually user wanted "Make the mirroring not send escape"
      // So if it's Escape, we process it locally but dont send to bots?

      if (keyReq.code === "Escape") {
          // Toggle UI
          if (type === "keydown") {
              uiVisible = !uiVisible;
              uiContainer.style.display = uiVisible ? "flex" : "none";
          }
          // Do NOT send escape to mirroring or game if we want to swallow it for menu
          // But user said "not send escape", usually implies not mirroring it.
          // We can return early here if we don't want the game to see it?
          // Or just let it pass to callback but NOT add to input state.

          // Let's allow the game to see it (to close game menus) but NOT mirror it.
      }

      if (ingame && keyReq.code === "KeyL") return;

      const keyCode = keyReq.code;

      // Track ALL keys EXCEPT movement keys (WASD/QZ) by default
      // UNLESS mirroring is turned on
      const mirrorAllEnabled = localStorage.getItem("mirrorAllInputs") === "true";

      // If it's a movement key, only track if mirroring is enabled
      if (MOVEMENT_KEYS.has(keyCode)) {
        if (mirrorAllEnabled) {
          if (!player.inputs.wasd[keyCode]) player.inputs.wasd[keyCode] = false;
          player.inputs.wasd[keyCode] = type === "keydown";
        }
      } else {
        // For ALL other keys (E, C, 1, 2, 3, M, Y, U, I, H, J, K, Space, Shift, etc.), always track them
        // EXCEPTION: Escape
        if (keyCode !== "Escape") {
            if (player.inputs.special[keyCode] === undefined) {
              player.inputs.special[keyCode] = false;
            }
            player.inputs.special[keyCode] = type === "keydown";
        }
      }

      return callback.apply(this, [keyReq]);
    };
  }
  return originalWindowAddEventListener.apply(this, args);
};

// Intercept mouse events with debouncing
HTMLDivElement.prototype.addEventListener = function(...args) {
  let type = args[0];
  if (type === "mousedown" || type === "mouseup" || type === "mousemove") {
    let callback = args[1];

    args[1] = function(...params) {
      let mouseReq = {
        isTrusted: true,
        clientX: params[0].clientX,
        clientY: params[0].clientY,
        button: params[0].button,
        preventDefault: function(){}
      };

      // Get button name
      const buttonName = MOUSE_BUTTONS[mouseReq.button];
      const now = Date.now();

      // Only update state if enough time has passed since last change
      if (mouseButtonStates[buttonName] && now - mouseButtonStates[buttonName].lastChange >= MIN_MOUSE_HOLD_TIME) {
        if (type === "mousedown") {
          player.inputs[buttonName] = true;
          mouseButtonStates[buttonName].pressed = true;
          mouseButtonStates[buttonName].lastChange = now;
        } else if (type === "mouseup") {
          player.inputs[buttonName] = false;
          mouseButtonStates[buttonName].pressed = false;
          mouseButtonStates[buttonName].lastChange = now;
        }
      }

      // Always update mouse position
      player.inputs.mouseX = mouseReq.clientX / window.innerWidth;
      player.inputs.mouseY = mouseReq.clientY / window.innerHeight;

      return callback.apply(this, [mouseReq]);
    };
  }
  return originalDivAddEventListener.apply(this, args);
};

// Intercept strokeText for coordinates
CanvasRenderingContext2D.prototype.strokeText = function(...args) {
  let text = args[0];
  if (typeof text !== 'string') return originalStrokeText.apply(this, args);

  if (text.includes("Coordinates: (")) {
    let coords = text.slice(14, text.length - 1).split(", ").map((x) => parseFloat(x));
    player.x = coords[0];
    player.y = coords[1];
  }

  // --- AUTO RESPAWN LOGIC INTEGRATION (CONTROLLED BY PARENT) ---
  // If we are a bot (!isParent) and parent says auto respawn is on
  if (!isParent && isEnabled) {
      // We need to check the parent state from localStorage
      // But reading localStorage every frame in strokeText might be slow.
      // However, we are already doing it in 'followParent'.
      // Let's use a cached state or check purely based on what 'followParent' has seen?
      // Actually, let's just read it here safely or use a global updated by followParent.
      // Better yet, let's just read it from the parsed 'lastParentData' if we had one.

      // For simplicity and robustness, let's read it directly but optimize if needed.
      // Actually, 'followParent' runs in mainLoop. Let's store the latest parent state in a global var for access here.
  }

  // To avoid reading LS here, let's look at 'currentParentState' which we will update in followParent
  if (currentParentState && currentParentState.inputs && currentParentState.inputs.autoRespawn) {
       // Detect "Respawn" text
      if (text === "Respawn" && !respawnCooldown) {
          console.log("Bot: Respawn detected via Parent Command!");
          respawnCooldown = true;
          isMovementBlocked = true;

          keyEvent("Enter", true);
          setTimeout(() => keyEvent("Enter", false), 50);
          setTimeout(() => respawnCooldown = false, 2000);
      }

      // Detect Spawn Message
      if (text.includes("You have spawned! Welcome to the game.") && isMovementBlocked) {
          console.log("Bot: Spawn confirmed.");

          setTimeout(async () => {
              if (currentParentState.inputs.autoUpgrade) {
                  const mName = currentParentState.inputs.lastMacro || "One way";
                  await performUpgradeSequence(mName);
              } else {
                  // If no upgrade, still do a quick wiggle to confirm control
                  ["KeyW", "KeyA", "KeyS", "KeyD"].forEach(k => {
                      keyEvent(k, true);
                      setTimeout(() => keyEvent(k, false), 50);
                  });
              }
              // CRITICAL FIX: Ensure movement is ALWAYS unblocked after spawn sequence
              isMovementBlocked = false;
              console.log("Bot: Movement unblocked.");
          }, 1500);
      }
  }
  // --------------------------------------------------

  return originalStrokeText.apply(this, args);
};

function keyEvent(key, type) {
  window.dispatchEvent(new KeyboardEvent(type ? "keydown" : "keyup", {
    code: key,
    key: key.replace("Key", "").replace("Arrow", "").replace("Digit", ""),
    bubbles: true,
    cancelable: true
  }));
}

function mouseEvent(x, y, button, type) {
  const event = new MouseEvent(type, {
    clientX: x,
    clientY: y,
    button: button,
    bubbles: true,
    cancelable: true
  });
  document.querySelector("#canvas")?.dispatchEvent(event);
}

// Function to release all pressed keys when disabling
function releaseAllKeys() {
  // Release all special keys
  for (const [key, isPressed] of mirroredKeyStates.entries()) {
    if (isPressed) {
      keyEvent(key, false);
      mirroredKeyStates.set(key, false);
    }
  }

  // Release all pending key presses
  for (const timeoutId of pendingKeyPresses.values()) {
    clearTimeout(timeoutId);
  }
  pendingKeyPresses.clear();

  // Release arrow keys
  if (mainLoop.lastArrowKeys.ArrowUp || mainLoop.lastArrowKeys.ArrowDown ||
      mainLoop.lastArrowKeys.ArrowLeft || mainLoop.lastArrowKeys.ArrowRight) {
    keyEvent("ArrowUp", false);
    keyEvent("ArrowLeft", false);
    keyEvent("ArrowDown", false);
    keyEvent("ArrowRight", false);
    mainLoop.lastArrowKeys = { ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false };
  }

  // Release mouse buttons
  for (const buttonName of MOUSE_BUTTONS) {
    if (mouseButtonStates[buttonName].pressed) {
      mouseButtonStates[buttonName].pressed = false;
      mouseButtonStates[buttonName].lastChange = Date.now();
    }
  }
}

// Handle keys with delay - FIXED to handle ALL keys properly
function handleKeyWithDelay(key, shouldPress) {
  // Don't process keys if bot is disabled
  if (!isEnabled) return;

  const currentState = mirroredKeyStates.get(key) || false;

  if (shouldPress === currentState) return;

  const pendingTimeout = pendingKeyPresses.get(key);
  if (pendingTimeout) {
    clearTimeout(pendingTimeout);
    pendingKeyPresses.delete(key);
  }

  if (shouldPress) {
    // Apply delay for all keys except movement keys
    const delay = MOVEMENT_KEYS.has(key) ? 0 : Math.random() * 250;

    const timeoutId = setTimeout(() => {
      keyEvent(key, true);
      mirroredKeyStates.set(key, true);
      pendingKeyPresses.delete(key);
    }, delay);

    pendingKeyPresses.set(key, timeoutId);
  } else {
    keyEvent(key, false);
    mirroredKeyStates.set(key, false);
  }
}

// Handle mouse buttons with debouncing for bot
function handleMouseButtonForBot(buttonIndex, shouldPress, x, y) {
  // Don't process mouse if bot is disabled
  if (!isEnabled) return;

  const buttonName = MOUSE_BUTTONS[buttonIndex];
  const now = Date.now();

  // Check if enough time has passed since last change
  if (now - mouseButtonStates[buttonName].lastChange < MIN_MOUSE_HOLD_TIME) {
    return;
  }

  // Check if state is already what we want
  if (shouldPress === mouseButtonStates[buttonName].pressed) {
    return;
  }

  // Update state and send event
  mouseButtonStates[buttonName].pressed = shouldPress;
  mouseButtonStates[buttonName].lastChange = now;

  const eventType = shouldPress ? "mousedown" : "mouseup";
  const event = new MouseEvent(eventType, {
    clientX: x,
    clientY: y,
    button: buttonIndex,
    bubbles: true,
    cancelable: true
  });

  document.querySelector("#canvas")?.dispatchEvent(event);
}

// Helper for sleep
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Upgrade Sequence Logic
let isUpgrading = false;

async function performUpgradeSequence(macroName) {
    if (isUpgrading) return;
    isUpgrading = true;

    const mName = macroName || lastMacroName || "One way";
    const macro = MACROS[mName] || MACROS["One way"];

    console.log(`Starting upgrade sequence for: ${mName}...`);

    try {
        // 1. Tank Upgrades (strings)
        // Each entry executed in order; ";" inside = pick one randomly.
        for (const entry of macro.strings) {
            const variants = entry.split(";");
            const chosen = variants[Math.floor(Math.random() * variants.length)];
            for (const char of chosen) {
                const key = "Key" + char.toUpperCase();
                keyEvent(key, true); await sleep(20);
                keyEvent(key, false);
                await sleep(10 + Math.random() * 40);
            }
        }

        await sleep(150);

        // 2. Skill Upgrades
        // Flatten all skill entries to individual presses, then group consecutive
        // M-held presses under a single M hold for efficiency.
        const presses = expandSkillSteps(macro.skills);
        let i = 0;
        while (i < presses.length) {
            if (presses[i].mHeld) {
                // Start M hold — keep holding through all consecutive M presses
                keyEvent("KeyM", true); await sleep(15);
                while (i < presses.length && presses[i].mHeld) {
                    keyEvent(presses[i].key, true); await sleep(20);
                    keyEvent(presses[i].key, false); await sleep(35);
                    i++;
                }
                keyEvent("KeyM", false); await sleep(50);
            } else {
                // Normal press, no M
                keyEvent(presses[i].key, true); await sleep(20);
                keyEvent(presses[i].key, false); await sleep(50);
                i++;
            }
        }
    } catch (e) {
        console.error("Error in upgrade sequence:", e);
    } finally {
        isUpgrading = false;
        console.log("Upgrade sequence finished.");
    }
}

// Main loop - FIXED: Parent only sends data when enabled
const mainLoop = {
  lastTime: 0,
  frameId: null,
  running: true,
  lastMasterCheck: 0,
  masterCheckInterval: 1000,
  lastMouseUpdate: 0,
  mouseUpdateInterval: 50,
  lastArrowKeys: { ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false },

  start() {
    const loop = (timestamp) => {
      if (!this.running) return;

      if (timestamp - this.lastTime >= 16) {
        this.update();
        this.lastTime = timestamp;
      }

      this.frameId = requestAnimationFrame(loop.bind(this));
    };

    this.frameId = requestAnimationFrame(loop.bind(this));
  },

  stop() {
    this.running = false;
    if (this.frameId) {
      cancelAnimationFrame(this.frameId);
    }

    releaseAllKeys();
  },

  update() {
    const now = Date.now();
    if (now - this.lastMasterCheck >= this.masterCheckInterval) {
      this.checkMasterControl();
      this.lastMasterCheck = now;
    }

    if (isParent) {
      // Ensure player inputs reflect current UI state for parent
      player.inputs.autoRespawn = autoRespawnEnabled;
      player.inputs.autoUpgrade = autoUpgradeOnRespawn;
      player.inputs.mouseFollow = mouseFollowEnabled;

      const mouseMirroring = localStorage.getItem("mouseMirroring") === "true";
      const betterAim = localStorage.getItem("betterAim") === "true";

      // Only compute world-space mouse target if needed by Mouse Follow OR Better Aim.
      // aspect ratio correction keeps physical mouse movements equal on both axes.
      if (mouseFollowEnabled || (mouseMirroring && betterAim)) {
        const aspect = window.innerWidth / window.innerHeight;
        const offsetX = (player.inputs.mouseX - 0.5) * mouseFollowScale;
        const offsetY = (player.inputs.mouseY - 0.5) * mouseFollowScale / aspect;
        player.inputs.mouseWorldX = player.x + offsetX;
        player.inputs.mouseWorldY = player.y + offsetY;
      } else {
        player.inputs.mouseWorldX = undefined;
        player.inputs.mouseWorldY = undefined;
      }

      // FIXED: Parent only sends data when enabled
      if (isEnabled) {
        // Pathing: Record breadcrumbs for Path Follow
        if (localStorage.getItem("pathFollow") === "true") {
          let pathNodes = [];
          try {
            pathNodes = JSON.parse(localStorage.getItem("parentPathNodes") || "[]");
          } catch(e) {}

          if (pathNodes.length === 0) {
            pathNodes.push({x: player.x, y: player.y});
          } else {
            const lastNode = pathNodes[pathNodes.length - 1];
            const dx = player.x - lastNode.x;
            const dy = player.y - lastNode.y;
            // Record a new node if the parent has moved 15 units since the last node
            if (dx * dx + dy * dy >= 225) {
              pathNodes.push({x: player.x, y: player.y});
              // Keep only the last 50 nodes to avoid unbounded growth
              if (pathNodes.length > 50) pathNodes.shift();
            }
          }
          localStorage.setItem("parentPathNodes", JSON.stringify(pathNodes));
        }

        try {
          localStorage.setItem("parent", JSON.stringify(player));
        } catch (e) {
          console.error("Failed to save parent data:", e);
        }
      } else {
        // Parent is disabled - clear any existing data
        try {
          localStorage.removeItem("parent");
        } catch (e) {
          console.error("Failed to clear parent data:", e);
        }
      }
    } else if (isEnabled) { // Bot only follows when enabled
      this.followParent();
    }
  },

  followParent() {
    // If movement is blocked (respawning), do nothing
    if (isMovementBlocked) return;
    // FIXED: Double-check isEnabled
    if (!isEnabled) return;

    try {
      const parentData = localStorage.getItem("parent");
      if (!parentData) return;

      const parent = JSON.parse(parentData);
      currentParentState = parent; // Update global for use in strokeText

      // Determine the follow target: mouse world position, path node, or parent position
      const followMouse = parent.inputs && parent.inputs.mouseFollow;
      let targetX = parent.x;
      let targetY = parent.y;

      if (followMouse) {
        targetX = parent.inputs.mouseWorldX;
        targetY = parent.inputs.mouseWorldY;
      } else if (localStorage.getItem("pathFollow") === "true") {
        let pathNodes = [];
        try {
          pathNodes = JSON.parse(localStorage.getItem("parentPathNodes") || "[]");
        } catch(e) {}

        if (pathNodes.length > 0) {
          // Find the closest node
          let closestIdx = 0;
          let minDSq = Infinity;
          for (let i = 0; i < pathNodes.length; i++) {
             const pdx = pathNodes[i].x - player.x;
             const pdy = pathNodes[i].y - player.y;
             const dSq = pdx * pdx + pdy * pdy;
             if (dSq < minDSq) {
               minDSq = dSq;
               closestIdx = i;
             }
          }
          // The bot should head to the NEXT node after the closest one to advance
          const targetNodeIdx = Math.min(closestIdx + 1, pathNodes.length - 1);
          const targetNode = pathNodes[targetNodeIdx];

          // Only follow the node if it's reasonably close to the breadcrumb trail.
          // If the bot gets hopelessly lost (> 100 units away from the closest node), just fly directly to parent.
          if (minDSq < 10000) {
             targetX = targetNode.x;
             targetY = targetNode.y;
          }
        }
      }

      const dx = targetX - player.x;
      const dy = targetY - player.y;
      const distanceSquared = dx * dx + dy * dy;

      // Read stop distance from localStorage (set by parent's slider)
      const storedDist = localStorage.getItem("followDistanceUnits");
      const effectiveDist = storedDist !== null ? Number(storedDist) : followDistanceUnits;
      const DIST_THRESHOLD_SQUARED = effectiveDist * effectiveDist;
      const movThreshold = BASE_MOV_THRESHOLD * (effectiveDist / BASE_DIST_THRESHOLD);


      // Handle ALL special keys (E, C, 1, 2, 3, M, Y, U, I, H, J, K, Space, Shift, etc.)
      if (parent.inputs.special) {
        for (let key of Object.keys(parent.inputs.special)) {
          const shouldPress = parent.inputs.special[key];
          handleKeyWithDelay(key, shouldPress);
        }
      }

      // Handle WASD/QZ keys if mirroring is enabled
      const mirrorAllEnabled = localStorage.getItem("mirrorAllInputs") === "true";
      if (mirrorAllEnabled && parent.inputs.wasd) {
        for (let [key, shouldPress] of Object.entries(parent.inputs.wasd)) {
          handleKeyWithDelay(key, shouldPress);
        }
      }

      // Mouse mirroring (clicks + movement + optional better aim)
      const mouseEnabled = localStorage.getItem("mouseMirroring") === "true";
      const betterAim = mouseEnabled && localStorage.getItem("betterAim") === "true";
      let aimX, aimY;

      // Determine correct screen coordinates for aiming
      if (betterAim && parent.inputs.mouseWorldX !== undefined) {
        // Better Aim: convert parent's world-space mouse target to this bot's screen coords.
  function computeFovSafeAimFromParent(parent) {
      // Parent normalized mouse -> parent pixel delta
      const pMouseX = (parent.inputs?.mouseX ?? 0.5) * window.innerWidth;
      const pMouseY = (parent.inputs?.mouseY ?? 0.5) * window.innerHeight;
      const parentDxPx = pMouseX - window.innerWidth / 2;
      const parentDyPx = pMouseY - window.innerHeight / 2;

  // Parent render scale (world units per px inverse). If missing, fallback.
      const pScale = Number(parent.inputs?.renderScale) || 1;

  // Convert parent screen delta -> world delta
      const worldDx = parentDxPx / pScale;
      const worldDy = parentDyPx / pScale;

  // Convert world delta -> this bot's screen delta using bot's live scale
  const bScale = Number(renderScale) || 1;
  const botDxPx = worldDx * bScale;
  const botDyPx = worldDy * bScale;

  return {
    x: window.innerWidth / 2 + botDxPx,
    y: window.innerHeight / 2 + botDyPx,
  };
}
        // Fallback: mirror raw screen position
        aimX = parent.inputs.mouseX * window.innerWidth;
        aimY = parent.inputs.mouseY * window.innerHeight;
      }

      // Mouse buttons — controlled by Mouse toggle. Send false if disabled to release stuck clicks.
      for (let buttonIndex = 0; buttonIndex < MOUSE_BUTTONS.length; buttonIndex++) {
        const buttonName = MOUSE_BUTTONS[buttonIndex];
        const shouldPress = mouseEnabled ? parent.inputs[buttonName] : false;
        if (shouldPress !== undefined) {
          handleMouseButtonForBot(buttonIndex, shouldPress, aimX, aimY);
        }
      }

      // Live mouse movement — completely disabled if Mouse toggle is off
      if (mouseEnabled) {
        const currentTime = Date.now();
        if (currentTime - this.lastMouseUpdate >= this.mouseUpdateInterval) {
          const event = new MouseEvent("mousemove", {
            clientX: aimX,
            clientY: aimY,
            bubbles: true,
            cancelable: true
          });
          document.querySelector("#canvas")?.dispatchEvent(event);
          this.lastMouseUpdate = currentTime;
        }
      }

      // Handle movement
      const disableMovementGlobal = localStorage.getItem("disableMovement") === "true";

      if (!disableMovementGlobal) {
        if (distanceSquared > DIST_THRESHOLD_SQUARED) {
          if (targetX > player.x + movThreshold) {
            if (!this.lastArrowKeys.ArrowRight) {
              keyEvent("ArrowLeft", false);
              keyEvent("ArrowRight", true);
              this.lastArrowKeys.ArrowLeft = false;
              this.lastArrowKeys.ArrowRight = true;
            }
          } else if (targetX < player.x - movThreshold) {
            if (!this.lastArrowKeys.ArrowLeft) {
              keyEvent("ArrowLeft", true);
              keyEvent("ArrowRight", false);
              this.lastArrowKeys.ArrowLeft = true;
              this.lastArrowKeys.ArrowRight = false;
            }
          } else {
            if (this.lastArrowKeys.ArrowLeft || this.lastArrowKeys.ArrowRight) {
              keyEvent("ArrowLeft", false);
              keyEvent("ArrowRight", false);
              this.lastArrowKeys.ArrowLeft = false;
              this.lastArrowKeys.ArrowRight = false;
            }
          }

          if (targetY > player.y + movThreshold) {
            if (!this.lastArrowKeys.ArrowDown) {
              keyEvent("ArrowUp", false);
              keyEvent("ArrowDown", true);
              this.lastArrowKeys.ArrowUp = false;
              this.lastArrowKeys.ArrowDown = true;
            }
          } else if (targetY < player.y - movThreshold) {
            if (!this.lastArrowKeys.ArrowUp) {
              keyEvent("ArrowUp", true);
              keyEvent("ArrowDown", false);
              this.lastArrowKeys.ArrowUp = true;
              this.lastArrowKeys.ArrowDown = false;
            }
          } else {
            if (this.lastArrowKeys.ArrowUp || this.lastArrowKeys.ArrowDown) {
              keyEvent("ArrowUp", false);
              keyEvent("ArrowDown", false);
              this.lastArrowKeys.ArrowUp = false;
              this.lastArrowKeys.ArrowDown = false;
            }
          }
        } else {
          if (this.lastArrowKeys.ArrowUp || this.lastArrowKeys.ArrowDown ||
              this.lastArrowKeys.ArrowLeft || this.lastArrowKeys.ArrowRight) {
            keyEvent("ArrowUp", false);
            keyEvent("ArrowLeft", false);
            keyEvent("ArrowDown", false);
            keyEvent("ArrowRight", false);
            this.lastArrowKeys = { ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false };
          }
        }
      } else {
        if (this.lastArrowKeys.ArrowUp || this.lastArrowKeys.ArrowDown ||
            this.lastArrowKeys.ArrowLeft || this.lastArrowKeys.ArrowRight) {
          keyEvent("ArrowUp", false);
          keyEvent("ArrowLeft", false);
          keyEvent("ArrowDown", false);
          keyEvent("ArrowRight", false);
          this.lastArrowKeys = { ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false };
        }
      }
    } catch (e) {
      console.error("Error following parent:", e);
    }
  },

  checkMasterControl() {
    if (isMasterController) return;

    try {
      const masterControlData = localStorage.getItem("masterControl");
      if (!masterControlData) return;

      const master = JSON.parse(masterControlData);
      const masterId = master.masterId;
      const timestamp = master.timestamp;

      if (Date.now() - timestamp > 30000) return;

      if (myMasterId !== masterId) {
        isParent = false;
        isEnabled = true;
        myMasterId = masterId;

        // Update UI toggles if following master
        updateToggles();

        console.info("Now following master:", masterId);
      }
    } catch (e) {
      console.error("Error checking master control:", e);
    }
  }
};

// Initialize
window.addEventListener('load', () => {
    // Set initial toggle states based on local storage
    toggleMirror.setChecked(localStorage.getItem("mirrorAllInputs") === "true");
    toggleMouse.setChecked(localStorage.getItem("liveMouse") === "true");
    // disableMovement is true for "Move Off", so Bot Movement On means disableMovement false
    toggleMov.setChecked(localStorage.getItem("disableMovement") !== "true");
});

// Start main loop
mainLoop.start();

// Listen for storage events (including upgrade command)
window.addEventListener('storage', (event) => {
  if (event.key === 'masterControl') {
    mainLoop.checkMasterControl();
  }

  if (event.key === 'botCommand') {
      try {
          const cmd = JSON.parse(event.newValue);
          if (cmd && cmd.type === 'upgrade') {
            // Check legality: bots only
            if (!isParent && isEnabled) {
                performUpgradeSequence(cmd.macro);
            }
          } else if (cmd && cmd.type === 'disconnect') {
            // Close all sockets in this tab
            disconnectAll();
          }
      } catch(e) {
          console.error("Error processing botCommand:", e);
      }
  }
});

// Cleanup
window.addEventListener("beforeunload", () => {
  mainLoop.stop();

  if (isMasterController && myMasterId) {
    localStorage.removeItem("masterControl");
  }

  // Restore original functions
  window.addEventListener = originalWindowAddEventListener;
  HTMLDivElement.prototype.addEventListener = originalDivAddEventListener;
  CanvasRenderingContext2D.prototype.strokeText = originalStrokeText;
  console.log = originalConsoleLog;
});
