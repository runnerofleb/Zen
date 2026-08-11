/* Revenue Command enterprise shell. The underlying guide data and logic are untouched. */
(function () {
  "use strict";

  function byId(id) { return document.getElementById(id); }
  function setText(node, value) { if (node && node.textContent !== value) node.textContent = value; }
  function text(node) { return node ? node.textContent.trim() : ""; }
  function click(id) { var node = byId(id); if (node) node.click(); }

  var wrap = document.querySelector(".wrap");
  var bar = document.querySelector(".bar");
  var setup = byId("setup");
  if (!wrap || !bar || !setup) return;

  /* Internal product masthead */
  var mast = document.createElement("div");
  mast.className = "enterprise-header";
  mast.innerHTML = '<span class="enterprise-wordmark">ZenBusiness</span><i class="enterprise-rule"></i>' +
    '<span class="enterprise-product">Revenue Command / June Sales Playbook</span>' +
    '<span class="enterprise-security">Internal enablement workspace</span>';
  wrap.insertBefore(mast, bar);

  /* Recompose the existing controls without replacing them or their event handlers. */
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
    var brand = mark.querySelector("b");
    var edition = mark.querySelector("small");
    setText(brand, "REVENUE OS");
    setText(edition, "CALL EXECUTION");
  }

  group("bar-identity", [".mark", "#stagePill"]);
  group("bar-telemetry", ["#clock", "#pace", "#readyPill", "#who"]);
  group("bar-controls", ["#btnStart", "#btnTReset", "#btnRush"]);
  group("bar-tools", ["#btnFocus", "#cartPill", "#btnSetup", ".ui-density-btn", ".ui-command-btn", "#btnHelp"]);
  var track = bar.querySelector(".track");
  if (track) bar.appendChild(track);

  /* Executive call brief */
  var mission = document.createElement("section");
  mission.className = "mission-control";
  mission.setAttribute("aria-label", "Live call executive brief");
  mission.innerHTML =
    '<div class="mission-account">' +
      '<div class="mission-kicker"><span class="live-signal">Active playbook</span><span id="missionPhase">Open phase</span></div>' +
      '<h1 id="missionAccount">New customer call</h1>' +
      '<p id="missionObjective">Load the account context, then lead the conversation one decision at a time.</p>' +
    '</div>' +
    '<div class="mission-stats">' +
      '<article class="mission-stat"><span>Execution stage</span><strong id="missionStage">01 / 18</strong><small id="missionStageName">Introduction</small></article>' +
      '<article class="mission-stat"><span>Call readiness</span><strong id="missionReady">0%</strong><small>Discovery signal</small><div class="mission-meter"><i id="missionReadyBar"></i></div></article>' +
      '<article class="mission-stat"><span>Progress</span><strong id="missionProgress">0%</strong><small>Playbook coverage</small><div class="mission-meter"><i id="missionProgressBar"></i></div></article>' +
      '<article class="mission-stat"><span>Call clock</span><strong id="missionClock">00:00</strong><small id="missionPace">On pace</small></article>' +
    '</div>' +
    '<div class="mission-actions">' +
      '<button type="button" id="missionSetup">Account dossier</button>' +
      '<button type="button" id="missionFocus">Focus script</button>' +
    '</div>';
  bar.insertAdjacentElement("afterend", mission);
  byId("missionSetup").addEventListener("click", function () { click("btnSetup"); });
  byId("missionFocus").addEventListener("click", function () { click("btnFocus"); });

  /* Turn setup into an account dossier drawer. */
  var backdrop = document.createElement("div");
  backdrop.className = "dossier-backdrop";
  document.body.appendChild(backdrop);

  var dossierHead = document.createElement("div");
  dossierHead.className = "dossier-head";
  dossierHead.innerHTML = '<span class="dossier-mark">ZB</span>' +
    '<span class="dossier-title"><span>Account intelligence</span><strong>Customer call dossier</strong><small>Context powers every personalized line in the playbook</small></span>' +
    '<button type="button" class="dossier-close" aria-label="Close account dossier">×</button>';
  setup.insertBefore(dossierHead, setup.firstChild);

  function setupVisible() { return window.getComputedStyle(setup).display !== "none"; }
  function syncDossier() {
    var open = setupVisible();
    backdrop.classList.toggle("on", open);
    document.body.classList.toggle("dossier-open", open);
  }
  dossierHead.querySelector(".dossier-close").addEventListener("click", function () { click("btnHideSetup"); });
  backdrop.addEventListener("click", function () { click("btnHideSetup"); });
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

  function enhanceStage(info, phase) {
    var panel = byId("stagePanel");
    if (!panel) return;
    var meta = panel.querySelector(".exec-stage-meta");
    if (!meta) {
      meta = document.createElement("div");
      meta.className = "exec-stage-meta";
      meta.innerHTML = '<div class="exec-sequence"><span>Execution sequence</span><strong></strong></div>' +
        '<div class="exec-stage-track"><i></i></div>' +
        '<div class="exec-phase"><span>Phase</span><strong></strong></div>';
      panel.insertBefore(meta, panel.firstChild);
    }
    var sequence = meta.querySelector(".exec-sequence strong");
    var phaseNode = meta.querySelector(".exec-phase strong");
    var meter = meta.querySelector(".exec-stage-track i");
    setText(sequence, "STEP " + String(info.index + 1).padStart(2, "0") + " OF " + String(info.total).padStart(2, "0"));
    setText(phaseNode, phaseNames[phase] || phase);
    meter.style.width = Math.round(info.index / Math.max(1, info.total - 1) * 100) + "%";
  }

  function enhanceRight() {
    var right = byId("right");
    if (!right || right.querySelector(".intel-rail-heading")) return;
    var heading = document.createElement("div");
    heading.className = "intel-rail-heading";
    heading.innerHTML = '<span>Call intelligence</span><strong>Live decision support</strong><small>Next move, customer language, close status, and objections</small>';
    right.insertBefore(heading, right.firstChild);
  }

  var syncQueued = false;
  function queueSync() {
    if (syncQueued) return;
    syncQueued = true;
    requestAnimationFrame(function () { syncQueued = false; syncEnterprise(); });
  }

  function syncEnterprise() {
    var info = currentStage();
    var current = info.current;
    var phase = current ? (current.getAttribute("data-phase") || document.documentElement.getAttribute("data-phase") || "open") : "open";
    var stageName = current ? current.cloneNode(true) : null;
    if (stageName) Array.prototype.forEach.call(stageName.querySelectorAll("small,.ic,.tick"), function (node) { node.remove(); });
    var cleanStage = stageName ? stageName.textContent.replace(/^\s*\d+\.\s*/, "").trim() : text(byId("stagePill")) || "Introduction";
    var readyText = text(byId("readyPill")) || "Ready 0%";
    var ready = parsePercent(readyText);
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
    setText(byId("missionStage"), String(info.index + 1).padStart(2, "0") + " / " + String(info.total).padStart(2, "0"));
    setText(byId("missionStageName"), cleanStage || "Introduction");
    setText(byId("missionReady"), ready + "%");
    setText(byId("missionProgress"), progress + "%");
    setText(byId("missionClock"), text(byId("clock")) || "00:00");
    setText(byId("missionPace"), (text(byId("pace")) || "On pace") + (plan ? " · " + plan : ""));
    byId("missionReadyBar").style.width = ready + "%";
    byId("missionProgressBar").style.width = progress + "%";
    document.documentElement.setAttribute("data-phase", phase);
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

  syncEnterprise();
})();

