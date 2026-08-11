/* ==========================================================================
   REVENUE DESK — ENTERPRISE SHELL v2
   Event-driven: the guide dispatches "cm:render" after every render and
   exposes its stage map through window.__cm, so the shell reads real state
   instead of scraping the DOM. If paired with an unpatched HTML file, it
   falls back to the old MutationObserver scraping automatically.
   Every element created here is presentational — guide logic is untouched.
   ========================================================================== */
(function () {
  "use strict";

  /* Helpers ---------------------------------------------------------------- */
  function byId(id) { return document.getElementById(id); }
  function setText(node, value) { if (node && node.textContent !== value) node.textContent = value; }
  function text(node) { return node ? node.textContent.trim() : ""; }
  function click(id) { var node = byId(id); if (node) node.click(); }
  function pad(n) { return String(n).padStart(2, "0"); }
  function fmt(sec) { sec = Math.max(0, Math.floor(sec || 0)); return pad(Math.floor(sec / 60)) + ":" + pad(sec % 60); }
  function phaseSlug(label) { return String(label || "open").trim().toLowerCase().replace(/[^a-z]+/g, "-"); }

  var wrap = document.querySelector(".wrap");
  var bar = document.querySelector(".bar");
  var setup = byId("setup");
  if (!wrap || !bar || !setup) return;

  var baseTitle = document.title;
  var phaseNames = { open: "Open", review: "Review", compliance: "Compliance", tax: "Tax advisory", close: "Close", reference: "Reference" };

  /* The guide's API, when the patched HTML is present ----------------------- */
  function guideAPI() {
    var cm = window.__cm;
    return (cm && cm.state && cm.stages && cm.stageIndex && cm.readiness) ? cm : null;
  }

  /* Masthead: letterhead above the command band. --------------------------- */
  var mast = document.createElement("div");
  mast.className = "ed-masthead";
  mast.innerHTML =
    '<span class="ed-wordmark">ZenBusiness</span>' +
    '<i class="ed-sep"></i>' +
    '<span class="ed-suite">Revenue Desk · June Sales Playbook</span>' +
    '<span class="ed-mast-meta"><em class="ed-date"></em><b class="ed-internal">Internal workspace</b></span>';
  setText(mast.querySelector(".ed-date"),
    new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }));
  wrap.insertBefore(mast, bar);

  /* Command bar: regroup the existing controls without replacing them. ----- */
  function group(className, selectors) {
    var node = document.createElement("div");
    node.className = className;
    selectors.forEach(function (selector) {
      var child = bar.querySelector(selector);
      if (child) node.appendChild(child);
    });
    bar.appendChild(node);
    return node;
  }

  var mark = bar.querySelector(".mark");
  if (mark) {
    setText(mark.querySelector("b"), "Revenue Desk");
    setText(mark.querySelector("small"), "JUNE GUIDE 2026");
  }

  group("bar-identity", [".mark", "#stagePill"]);
  group("bar-telemetry", ["#clock", "#pace", "#readyPill", "#who"]);
  group("bar-controls", ["#btnStart", "#btnTReset", "#btnRush"]);
  group("bar-tools", ["#btnFocus", "#cartPill", "#btnSetup", ".ui-density-btn", ".ui-command-btn", "#btnHelp"]);
  var track = bar.querySelector(".track");
  if (track) bar.appendChild(track);

  var focusBtn = byId("btnFocus");
  if (focusBtn && !focusBtn.getAttribute("aria-label")) focusBtn.setAttribute("aria-label", "Focus mode");

  /* Call sheet: account name beside ruled ledger columns. ------------------ */
  var callsheet = document.createElement("section");
  callsheet.className = "ed-callsheet";
  callsheet.setAttribute("aria-label", "Live call sheet");
  callsheet.innerHTML =
    '<div class="ed-cs-lead">' +
      '<div class="ed-cs-kicker">' +
        '<span class="ed-live">Live call sheet</span>' +
        '<span class="ed-stamp" id="missionPhase">Open phase</span>' +
      '</div>' +
      '<h1 id="missionAccount">New customer call</h1>' +
      '<p id="missionObjective">Load the account context, then lead the conversation one decision at a time.</p>' +
      '<div class="ed-cs-actions">' +
        '<button type="button" id="missionSetup">Open account dossier</button>' +
        '<button type="button" id="missionFocus">Focus the script</button>' +
      '</div>' +
    '</div>' +
    '<div class="ed-cs-ledger" role="group" aria-label="Call status">' +
      '<article class="ed-cs-cell"><span>Stage</span><strong id="missionStage">01 / 18</strong><small id="missionStageName">Introduction</small></article>' +
      '<article class="ed-cs-cell"><span>Readiness</span><strong id="missionReady">0%</strong><div class="ed-meter"><i id="missionReadyBar"></i></div><small>Discovery signal</small></article>' +
      '<article class="ed-cs-cell"><span>Coverage</span><strong id="missionProgress">0%</strong><div class="ed-meter"><i id="missionProgressBar"></i></div><small>Guide completed</small></article>' +
      '<article class="ed-cs-cell"><span>Call clock</span><strong id="missionClock">00:00</strong><small id="missionPace">On pace</small></article>' +
    '</div>';
  bar.insertAdjacentElement("afterend", callsheet);
  byId("missionSetup").addEventListener("click", function () { click("btnSetup"); });
  byId("missionFocus").addEventListener("click", function () { click("btnFocus"); });

  /* Account dossier: setup becomes a right-hand drawer. -------------------- */
  var backdrop = document.createElement("div");
  backdrop.className = "dossier-backdrop";
  document.body.appendChild(backdrop);

  var dossierHead = document.createElement("div");
  dossierHead.className = "dossier-head";
  dossierHead.innerHTML =
    '<span class="dossier-mark">ZB</span>' +
    '<span class="dossier-title"><span>Account intelligence</span><strong>Customer call dossier</strong><small>Context powers every personalized line in the playbook</small></span>' +
    '<button type="button" class="dossier-close" aria-label="Close account dossier">×</button>';
  setup.insertBefore(dossierHead, setup.firstChild);

  function setupVisible() { return window.getComputedStyle(setup).display !== "none"; }
  function closeDossier() { if (setupVisible()) click("btnHideSetup"); }
  dossierHead.querySelector(".dossier-close").addEventListener("click", closeDossier);
  backdrop.addEventListener("click", closeDossier);

  /* Dossier focus management: trap Tab inside, return focus on close. */
  function focusables() {
    return Array.prototype.filter.call(
      setup.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'),
      function (node) { return !node.disabled && node.offsetParent !== null; }
    );
  }

  var lastFocused = null;
  var wasOpen = setupVisible();
  function syncDossier() {
    var open = setupVisible();
    backdrop.classList.toggle("on", open);
    document.body.classList.toggle("dossier-open", open);
    if (open && !wasOpen) {
      lastFocused = document.activeElement;
      var target = setup.querySelector("input") || focusables()[0];
      if (target) target.focus();
    } else if (!open && wasOpen && lastFocused && document.contains(lastFocused)) {
      lastFocused.focus();
    }
    wasOpen = open;
  }
  new MutationObserver(syncDossier).observe(setup, { attributes: true, attributeFilter: ["style"] });
  syncDossier();

  setup.addEventListener("keydown", function (event) {
    if (event.key !== "Tab") return;
    var nodes = focusables();
    if (!nodes.length) return;
    var first = nodes[0];
    var last = nodes[nodes.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });

  /* Esc closes the dossier — after the guide's own overlays have first say. */
  document.addEventListener("keydown", function (event) {
    if (event.key !== "Escape") return;
    var obj = byId("objScrim"), help = byId("helpScrim"), focus = byId("focus");
    if ((obj && obj.classList.contains("on")) ||
        (help && help.classList.contains("on")) ||
        (focus && focus.classList.contains("on"))) return;
    var tag = (event.target && event.target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return;
    closeDossier();
  });

  /* Screen-reader live region ---------------------------------------------- */
  var live = document.createElement("div");
  live.className = "ed-sr-live";
  live.setAttribute("aria-live", "polite");
  document.body.appendChild(live);
  var lastMessage = "";
  function announce(stageLabel, stageName, phase) {
    var message = "Step " + stageLabel +
      (stageName ? " — " + stageName : "") +
      ". " + (phaseNames[phase] || phase) + " phase";
    if (message !== lastMessage) { lastMessage = message; live.textContent = message; }
  }

  /* Stamp settle on phase change ------------------------------------------- */
  var lastPhase = null;
  function settleStamps() {
    Array.prototype.forEach.call(document.querySelectorAll(".ed-stamp"), function (node) {
      node.classList.remove("is-settling");
      void node.offsetWidth;
      node.classList.add("is-settling");
    });
  }

  /* Document header line inside the stage panel ---------------------------- */
  function enhanceStage(index, total, phase) {
    var panel = byId("stagePanel");
    if (!panel) return;
    var line = panel.querySelector(".ed-docline");
    if (!line) {
      line = document.createElement("div");
      line.className = "ed-docline";
      line.innerHTML =
        '<div class="ed-seq"><span>Step</span><strong></strong></div>' +
        '<div class="ed-rule"><i></i></div>' +
        '<span class="ed-stamp"></span>';
      panel.insertBefore(line, panel.firstChild);
    }
    setText(line.querySelector(".ed-seq strong"), pad(index + 1) + " / " + pad(total));
    setText(line.querySelector(".ed-stamp"), (phaseNames[phase] || phase) + " phase");
    line.querySelector(".ed-rule i").style.width =
      Math.round(index / Math.max(1, total - 1) * 100) + "%";
  }

  /* Heading over the right-hand margin rail -------------------------------- */
  function enhanceRight() {
    var right = byId("right");
    if (!right || right.querySelector(".ed-margin-head")) return;
    var heading = document.createElement("div");
    heading.className = "ed-margin-head";
    heading.innerHTML = '<span>Margin notes</span><strong>Live decision support</strong><small>Next lane · exact wording · objection answers</small>';
    right.insertBefore(heading, right.firstChild);
  }

  /* Fallback readers for an unpatched HTML --------------------------------- */
  function domStageInfo() {
    var items = Array.prototype.slice.call(document.querySelectorAll("#rail li[data-stage]"));
    var current = document.querySelector("#rail li.cur");
    var index = Math.max(0, items.indexOf(current));
    var name = "Introduction";
    if (current) {
      var clone = current.cloneNode(true);
      Array.prototype.forEach.call(clone.querySelectorAll("small,.ic,.tick"), function (n) { n.remove(); });
      name = clone.textContent.replace(/^\s*\d+\.\s*/, "").trim() || name;
    }
    var phase = current ? (current.getAttribute("data-phase") ||
      document.documentElement.getAttribute("data-phase") || "open") : "open";
    var match = String(text(byId("readyPill")) || "").match(/(\d+)/);
    return {
      index: index,
      total: items.length || 18,
      name: name,
      phase: phase,
      ready: match ? Math.max(0, Math.min(100, parseInt(match[1], 10))) : 0,
      clock: text(byId("clock")) || "00:00",
      state: (window.__cm && window.__cm.state) ? window.__cm.state() : null
    };
  }

  /* The sync — one read of the desk, one write to the sheet ---------------- */
  var syncQueued = false;
  function queueSync() {
    if (syncQueued) return;
    syncQueued = true;
    requestAnimationFrame(function () { syncQueued = false; syncDesk(); });
  }

  function syncDesk() {
    var cm = guideAPI(), info;
    if (cm) {
      var st = cm.state();
      var stages = cm.stages();
      var index = Math.max(0, Math.min(stages.length - 1, cm.stageIndex(st.stage)));
      info = {
        index: index,
        total: stages.length,
        name: stages[index].name,
        phase: phaseSlug(stages[index].phase),
        ready: Math.max(0, Math.min(100, Math.round(cm.readiness()))),
        clock: fmt(st.elapsed),
        state: st
      };
    } else {
      info = domStageInfo();
    }

    var f = info.state && info.state.f ? info.state.f : {};
    var customer = String(f.customerName || "").trim();
    var business = String(f.businessName || "").trim();
    var plan = String(f.packageName || "").trim();
    var account = customer && business ? customer + " / " + business : (customer || business || "New customer call");
    var progress = Math.round(info.index / Math.max(1, info.total - 1) * 100);

    var objective = document.querySelector("#stagePanel .goal");
    var objectiveText = objective ? objective.textContent.replace(/\s+/g, " ").trim()
      : "Guide the conversation one decision at a time.";
    if (objectiveText.length > 118) objectiveText = objectiveText.slice(0, 115) + "…";

    setText(byId("missionPhase"), (phaseNames[info.phase] || info.phase) + " phase");
    setText(byId("missionAccount"), account);
    setText(byId("missionObjective"), objectiveText);
    setText(byId("missionStage"), pad(info.index + 1) + " / " + pad(info.total));
    setText(byId("missionStageName"), info.name);
    setText(byId("missionReady"), info.ready + "%");
    setText(byId("missionProgress"), progress + "%");
    setText(byId("missionClock"), info.clock);
    setText(byId("missionPace"), (text(byId("pace")) || "On pace") + (plan ? " · " + plan : ""));
    byId("missionReadyBar").style.width = info.ready + "%";
    byId("missionProgressBar").style.width = progress + "%";
    document.documentElement.setAttribute("data-phase", info.phase);
    document.title = account === "New customer call" ? baseTitle : account + " — Revenue Desk";

    enhanceStage(info.index, info.total, info.phase);
    enhanceRight();

    if (info.phase !== lastPhase) {
      if (lastPhase !== null) settleStamps();
      lastPhase = info.phase;
    }
    announce(pad(info.index + 1) + " / " + pad(info.total), info.name, info.phase);
  }

  /* Wiring: the render event drives everything ----------------------------- */
  document.addEventListener("cm:render", queueSync);

  if (!guideAPI()) {
    /* Unpatched HTML — fall back to watching the DOM the old way. */
    var rail = byId("rail");
    var center = byId("center");
    var right = byId("right");
    if (rail) new MutationObserver(queueSync).observe(rail, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style"] });
    if (center) new MutationObserver(queueSync).observe(center, { childList: true, subtree: true });
    if (right) new MutationObserver(queueSync).observe(right, { childList: true });
    new MutationObserver(queueSync).observe(bar, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["class"] });
    setup.addEventListener("input", queueSync);
    document.addEventListener("click", function () { setTimeout(queueSync, 0); });
  } else {
    /* The stage panel is re-rendered by the guide; keep the docline fresh even
       for renders that happen before our listener attaches. */
    var centerNode = byId("center");
    if (centerNode) new MutationObserver(queueSync).observe(centerNode, { childList: true });
  }

  /* Focus mode: page-turn animation on every line change ------------------- */
  var fCard = byId("fCard");
  if (fCard) {
    var turnQueued = null;
    new MutationObserver(function () {
      if (turnQueued) return;
      turnQueued = requestAnimationFrame(function () {
        turnQueued = null;
        fCard.classList.remove("is-turning");
        void fCard.offsetWidth;
        fCard.classList.add("is-turning");
      });
    }).observe(fCard, { childList: true });
  }

  syncDesk();
})();
