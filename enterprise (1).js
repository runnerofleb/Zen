/* Revenue Desk enterprise shell.
   Recomposes the guide's existing chrome — the underlying data, handlers,
   and logic are untouched. Every element created here is presentational. */
(function () {
  "use strict";

  function byId(id) { return document.getElementById(id); }
  function setText(node, value) { if (node && node.textContent !== value) node.textContent = value; }
  function text(node) { return node ? node.textContent.trim() : ""; }
  function click(id) { var node = byId(id); if (node) node.click(); }
  function pad(n) { return String(n).padStart(2, "0"); }

  var wrap = document.querySelector(".wrap");
  var bar = document.querySelector(".bar");
  var setup = byId("setup");
  if (!wrap || !bar || !setup) return;

  var baseTitle = document.title;

  /* Masthead: letterhead above the command band. ------------------------- */
  var mast = document.createElement("div");
  mast.className = "ed-masthead";
  var today = new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  mast.innerHTML =
    '<span class="ed-wordmark">ZenBusiness</span>' +
    '<i class="ed-sep"></i>' +
    '<span class="ed-suite">Revenue Desk · June Sales Playbook</span>' +
    '<span class="ed-mast-meta"><em class="ed-date"></em><b class="ed-internal">Internal workspace</b></span>';
  setText(mast.querySelector(".ed-date"), today);
  wrap.insertBefore(mast, bar);

  /* Command bar: regroup the existing controls without replacing them. --- */
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

  /* Call sheet: account name beside ruled ledger columns. ---------------- */
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

  /* Account dossier: setup becomes a right-hand drawer. ------------------ */
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
  function syncDossier() {
    var open = setupVisible();
    backdrop.classList.toggle("on", open);
    document.body.classList.toggle("dossier-open", open);
  }
  function closeDossier() { if (setupVisible()) click("btnHideSetup"); }
  dossierHead.querySelector(".dossier-close").addEventListener("click", closeDossier);
  backdrop.addEventListener("click", closeDossier);
  new MutationObserver(syncDossier).observe(setup, { attributes: true, attributeFilter: ["style"] });
  syncDossier();

  var phaseNames = {
    open: "Open",
    review: "Review",
    compliance: "Compliance",
    tax: "Tax advisory",
    close: "Close",
    reference: "Reference"
  };

  function currentStage() {
    var items = Array.prototype.slice.call(document.querySelectorAll("#rail li[data-stage]"));
    var current = document.querySelector("#rail li.cur");
    var index = Math.max(0, items.indexOf(current));
    return { items: items, current: current, index: index, total: items.length || 18 };
  }

  function parsePercent(value) {
    var match = String(value || "").match(/(\d+)/);
    return match ? Math.max(0, Math.min(100, parseInt(match[1], 10))) : 0;
  }

  /* Document header line inside the stage panel. ------------------------- */
  function enhanceStage(info, phase) {
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
    setText(line.querySelector(".ed-seq strong"), pad(info.index + 1) + " / " + pad(info.total));
    setText(line.querySelector(".ed-stamp"), (phaseNames[phase] || phase) + " phase");
    line.querySelector(".ed-rule i").style.width =
      Math.round(info.index / Math.max(1, info.total - 1) * 100) + "%";
  }

  /* Heading over the right-hand margin rail. ----------------------------- */
  function enhanceRight() {
    var right = byId("right");
    if (!right || right.querySelector(".ed-margin-head")) return;
    var heading = document.createElement("div");
    heading.className = "ed-margin-head";
    heading.innerHTML = '<span>Margin notes</span><strong>Live decision support</strong><small>Next lane · exact wording · objection answers</small>';
    right.insertBefore(heading, right.firstChild);
  }

  var syncQueued = false;
  function queueSync() {
    if (syncQueued) return;
    syncQueued = true;
    requestAnimationFrame(function () { syncQueued = false; syncDesk(); });
  }

  function syncDesk() {
    var info = currentStage();
    var current = info.current;
    var phase = current ? (current.getAttribute("data-phase") || document.documentElement.getAttribute("data-phase") || "open") : "open";
    var stageName = current ? current.cloneNode(true) : null;
    if (stageName) Array.prototype.forEach.call(stageName.querySelectorAll("small,.ic,.tick"), function (node) { node.remove(); });
    var cleanStage = stageName ? stageName.textContent.replace(/^\s*\d+\.\s*/, "").trim() : text(byId("stagePill")) || "Introduction";
    var ready = parsePercent(text(byId("readyPill")) || "Ready 0%");
    var progress = Math.round(info.index / Math.max(1, info.total - 1) * 100);
    var state = window.__cm && window.__cm.state ? window.__cm.state() : null;
    var customer = state && state.f ? String(state.f.customerName || "").trim() : "";
    var business = state && state.f ? String(state.f.businessName || "").trim() : "";
    var plan = state && state.f ? String(state.f.packageName || "").trim() : "";
    var account = customer && business ? customer + " / " + business : (customer || business || "New customer call");
    var objective = document.querySelector("#stagePanel .goal");
    var objectiveText = objective ? objective.textContent.replace(/\s+/g, " ").trim() : "Guide the conversation one decision at a time.";
    if (objectiveText.length > 118) objectiveText = objectiveText.slice(0, 115) + "…";

    setText(byId("missionPhase"), (phaseNames[phase] || phase) + " phase");
    setText(byId("missionAccount"), account);
    setText(byId("missionObjective"), objectiveText);
    setText(byId("missionStage"), pad(info.index + 1) + " / " + pad(info.total));
    setText(byId("missionStageName"), cleanStage || "Introduction");
    setText(byId("missionReady"), ready + "%");
    setText(byId("missionProgress"), progress + "%");
    setText(byId("missionClock"), text(byId("clock")) || "00:00");
    setText(byId("missionPace"), (text(byId("pace")) || "On pace") + (plan ? " · " + plan : ""));
    byId("missionReadyBar").style.width = ready + "%";
    byId("missionProgressBar").style.width = progress + "%";
    document.documentElement.setAttribute("data-phase", phase);
    document.title = account === "New customer call" ? baseTitle : account + " — Revenue Desk";
    enhanceStage(info, phase);
    enhanceRight();
  }

  var rail = byId("rail");
  var center = byId("center");
  var right = byId("right");
  var observerConfig = { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style"] };
  if (rail) new MutationObserver(queueSync).observe(rail, observerConfig);
  if (center) new MutationObserver(queueSync).observe(center, { childList: true, subtree: true });
  if (right) new MutationObserver(queueSync).observe(right, { childList: true });
  new MutationObserver(queueSync).observe(bar, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["class"] });
  setup.addEventListener("input", queueSync);
  setup.addEventListener("click", function () { setTimeout(queueSync, 0); });
  document.addEventListener("click", function () { setTimeout(queueSync, 0); });

  syncDesk();
})();

/* ==========================================================================
   PATCH 1 — dossier focus management, live announcements, stamp settle
   Append-only: safe to paste at the bottom of the existing file.
   ========================================================================== */
(function () {
  "use strict";

  var setup = document.getElementById("setup");
  if (!setup) return;

  /* Screen-reader announcements when the stage or phase changes. --------- */
  var live = document.createElement("div");
  live.className = "ed-sr-live";
  live.setAttribute("aria-live", "polite");
  document.body.appendChild(live);

  var lastMessage = "";
  function announce() {
    var stage = document.getElementById("missionStage");
    var name = document.getElementById("missionStageName");
    var phase = document.getElementById("missionPhase");
    var message = "Step " + (stage ? stage.textContent : "") +
      (name && name.textContent ? " — " + name.textContent : "") +
      (phase && phase.textContent ? ". " + phase.textContent : "");
    if (message !== lastMessage) { lastMessage = message; live.textContent = message; }
  }

  /* Stamp settle: press the mark again whenever the phase changes. ------- */
  var lastPhase = document.documentElement.getAttribute("data-phase");
  new MutationObserver(function () {
    var phase = document.documentElement.getAttribute("data-phase");
    if (phase !== lastPhase) {
      lastPhase = phase;
      Array.prototype.forEach.call(document.querySelectorAll(".ed-stamp"), function (node) {
        node.classList.remove("is-settling");
        void node.offsetWidth; /* restart the animation */
        node.classList.add("is-settling");
      });
    }
    announce();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-phase"] });

  var stageCell = document.getElementById("missionStage");
  if (stageCell) {
    new MutationObserver(announce).observe(stageCell, { childList: true, characterData: true, subtree: true });
  }

  /* Dossier focus management: trap Tab inside, return focus on close. ---- */
  function focusables() {
    return Array.prototype.filter.call(
      setup.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'),
      function (node) { return !node.disabled && node.offsetParent !== null; }
    );
  }

  function dossierVisible() { return window.getComputedStyle(setup).display !== "none"; }

  var lastFocused = null;
  var wasOpen = dossierVisible();
  new MutationObserver(function () {
    var open = dossierVisible();
    if (open && !wasOpen) {
      lastFocused = document.activeElement;
      var target = setup.querySelector("input") || focusables()[0];
      if (target) target.focus();
    } else if (!open && wasOpen && lastFocused && document.contains(lastFocused)) {
      lastFocused.focus();
    }
    wasOpen = open;
  }).observe(setup, { attributes: true, attributeFilter: ["style"] });

  setup.addEventListener("keydown", function (event) {
    if (event.key !== "Tab") return;
    var nodes = focusables();
    if (!nodes.length) return;
    var first = nodes[0];
    var last = nodes[nodes.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });

  /* The mobile bar reduces Focus to an icon — give it an accessible name. */
  var focusBtn = document.getElementById("btnFocus");
  if (focusBtn && !focusBtn.getAttribute("aria-label")) focusBtn.setAttribute("aria-label", "Focus mode");
})();

/* ==========================================================================
   PATCH 2 — focus mode: page-turn animation on every line change
   Append-only: safe to paste at the bottom of the existing file.
   ========================================================================== */
(function () {
  "use strict";

  var card = document.getElementById("fCard");
  if (!card) return;

  var queued = null;
  new MutationObserver(function () {
    if (queued) return;
    queued = requestAnimationFrame(function () {
      queued = null;
      card.classList.remove("is-turning");
      void card.offsetWidth; /* restart the animation */
      card.classList.add("is-turning");
    });
  }).observe(card, { childList: true });
})();
