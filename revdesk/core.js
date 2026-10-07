/* Revenue Desk domain rules. No DOM, network requests, or payment processing. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RevDeskCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const VERSION = 3;
  const SERVICES = { planning: 'Tax planning', filing: 'Tax filing', books: 'Bookkeeping', agent: 'Registered agent', ein: 'EIN', agreement: 'Operating agreement', licenses: 'License report', website: 'Website' };
  const FACTS = { need: 'Need', impact: 'Impact', timing: 'Timing', decision: 'Decision', fit: 'Fit', criterion: 'Decision criteria' };
  const LANES = { tax: ['planning', 'filing', 'books'], agent: ['agent'], books: ['books'], setup: ['ein', 'agreement', 'licenses'], website: ['website'] };
  const OBJECTIONS = {
    cost: { label: 'Price / budget', question: 'When you say the price is a concern, is it the amount available right now, or whether the service is worth the cost?', listen: 'Separate a cash-flow constraint from an unanswered value question.', options: ['Cash flow', 'Value is unclear', 'Comparing options'], drill: 'Ask what the customer is comparing and what a useful outcome would be before suggesting a different payment option.' },
    timing: { label: 'Timing', question: 'What would need to change for this to become the right time?', listen: 'A real dependency, a specific date, or no present need.', options: ['Waiting on an event', 'Specific future date', 'No current need'], drill: 'Ask for the event that changes the decision. Agree on a callback only when the customer wants one.' },
    value: { label: 'Value / fit', question: 'Which part feels useful, and which part does not fit what you need?', listen: 'The gap between the proposed service and the customer’s actual priority.', options: ['Scope mismatch', 'Already covered', 'Benefit unclear'], drill: 'Use the customer’s stated problem to explain one relevant capability. Check whether that solves the concern.' },
    trust: { label: 'Trust / proof', question: 'What would you want to see or understand to feel comfortable making a decision?', listen: 'Specific evidence, terms, provider details, or a service boundary.', options: ['Needs proof', 'Terms unclear', 'Provider questions'], drill: 'Find the exact evidence they need. Offer an approved source or a concrete answer, then confirm whether it resolves the concern.' },
    authority: { label: 'Partner / approval', question: 'What will the two of you need to agree on, and would a short conversation together help?', listen: 'Who decides, what matters to them, and whether they want a joint conversation.', options: ['Joint decision needed', 'Approval pending', 'Can decide today'], drill: 'Clarify who else decides early. Invite the second decision-maker with the customer’s permission.' },
    thinking: { label: '“Let me think”', question: 'Of course. What part would be most helpful to think through together before we finish?', listen: 'An unanswered question, comparison, timing issue, or a clear preference to stop.', options: ['Open question', 'Comparing options', 'Prefers to stop'], drill: 'Ask one open question, listen to the answer, and accept a clear decline.' }
  };
  const money = cents => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: cents % 100 ? 2 : 0 }).format((cents || 0) / 100);
  const uid = () => typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'rd-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
  const clone = value => JSON.parse(JSON.stringify(value));
  const text = value => typeof value === 'string' ? value.trim() : '';
  function cents(value) {
    if (!/^\d+(\.\d{1,2})?$/.test(String(value).trim())) throw new Error('Enter a positive amount with up to two decimal places.');
    const n = Math.round(Number(value) * 100);
    if (!Number.isSafeInteger(n) || n <= 0 || n > 100000000) throw new Error('Amount must be between $0.01 and $1,000,000.');
    return n;
  }
  function workspace() {
    return { version: VERSION, revision: 0, activeId: null, deals: [], sessions: [], events: [], settings: { repName: '', timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York', targetDeals: 5 }, catalog: null };
  }
  function deal(input = {}, now = new Date().toISOString()) {
    return { id: uid(), name: text(input.name), business: text(input.business), email: text(input.email), phone: text(input.phone), industry: text(input.industry), entity: text(input.entity), source: text(input.source) || 'Manual', cohort: input.cohort === 'baseline' ? 'baseline' : 'adaptive', createdAt: now, updatedAt: now, lane: 'tax', facts: Object.fromEntries(Object.keys(FACTS).map(k => [k, ''])), coverage: Object.fromEntries(Object.keys(SERVICES).map(k => [k, 'unknown'])), coverageNotes: {}, decisionType: 'unknown', decisionReady: false, permission: false, rushed: false, notes: '', objection: null, quote: null, acceptedAt: null, authorizedAt: null, activatedAt: null, task: null, disposition: 'open', lossReason: '', doNotContact: false, history: [] };
  }
  function addHistory(d, message, now = new Date().toISOString()) { d.history.push({ id: uid(), at: now, message }); d.updatedAt = now; }
  function needs(d) { return (LANES[d.lane] || LANES.tax).filter(k => d.coverage[k] === 'gap'); }
  function unknowns(d) { return (LANES[d.lane] || LANES.tax).filter(k => d.coverage[k] === 'unknown'); }
  function recommendation(d, catalog) {
    if (!text(d.facts.need) || unknowns(d).length) return null;
    const gaps = needs(d);
    if (!gaps.length) return null;
    const candidates = catalog.filter(p => p.services.length && p.services.every(k => gaps.includes(k)));
    candidates.sort((a, b) => b.services.length - a.services.length || a.order - b.order);
    return candidates[0] || null;
  }
  function paymentEvents(w, id) { return w.events.filter(e => e.dealId === id && e.type === 'payment'); }
  function grossPaid(w, id) { return paymentEvents(w, id).reduce((sum, e) => sum + e.amount, 0); }
  function refunds(w, id) { return w.events.filter(e => e.dealId === id && e.type === 'refund').reduce((sum, e) => sum + e.amount, 0); }
  function netPaid(w, id) { return grossPaid(w, id) - refunds(w, id); }
  function status(w, d) {
    if (grossPaid(w, d.id) && netPaid(w, d.id) === 0) return 'Refunded';
    if (grossPaid(w, d.id) && refunds(w, d.id)) return 'Partially refunded';
    if (d.activatedAt && netPaid(w, d.id) > 0) return 'Activated';
    if (netPaid(w, d.id) > 0) return 'Paid';
    if (d.disposition === 'declined') return 'Declined';
    if (d.disposition === 'deferred') return 'Follow-up';
    if (d.authorizedAt) return 'Authorized';
    if (d.acceptedAt) return 'Accepted';
    if (d.quote) return 'Recommended';
    if (text(d.facts.need)) return 'Discovery';
    return 'New';
  }
  function quoteTotal(q) { return q ? q.lines.reduce((sum, l) => sum + l.amount, 0) : 0; }
  function contractTotal(q) { return q ? q.lines.reduce((sum, l) => sum + l.amount * (l.billing === 'monthly' ? l.months : 1), 0) : 0; }
  function quoteValid(q, now = Date.now()) {
    return !!(q && q.lines.length && q.verified && text(q.source) && text(q.scope) && text(q.terms) && Date.parse(q.verifiedAt) <= now && Date.parse(q.expiresAt) > now);
  }
  function quoteCompatible(d) { return !!(d.quote && d.quote.lines.every(l => l.services.every(k => d.coverage[k] === 'gap'))); }
  function commitReady(d, now = Date.now()) {
    if (!quoteValid(d.quote, now)) return 'Verify the current price, scope, eligibility, and terms before asking for agreement.';
    if (!quoteCompatible(d)) return 'Coverage changed. Rebuild the recommendation for the confirmed gaps.';
    if (!text(d.facts.need) || !text(d.facts.fit)) return 'Record the customer’s need and their confirmation that the service fits.';
    if (!text(d.facts.decision) || d.decisionType === 'unknown' || (d.decisionType === 'shared' && !d.decisionReady)) return 'Confirm who can approve this decision and whether the necessary people have agreed.';
    if (d.objection && !d.objection.resolved) return 'Resolve the open concern or agree on a next step first.';
    if (d.disposition === 'declined') return 'This customer declined. Reopen only if they choose to reconsider.';
    return '';
  }
  function saveQuote(d, q, now = new Date().toISOString()) {
    if (d.acceptedAt) throw new Error('An accepted offer is locked. Reopen the offer before changing it.');
    if (!quoteValid(q, Date.parse(now))) throw new Error('Confirm the source, scope, current price, terms, and verification date.');
    for (const l of q.lines) {
      if (!Number.isSafeInteger(l.amount) || l.amount <= 0 || !['annual', 'monthly', 'once'].includes(l.billing)) throw new Error('The offer contains an invalid price or billing period.');
      if (!l.services.length || l.services.some(k => d.coverage[k] !== 'gap')) throw new Error('Every included service must address a confirmed gap.');
      if (!Number.isInteger(l.months) || l.months < 1 || l.months > 60) throw new Error('Confirm the commitment length.');
    }
    if (d.quote && JSON.stringify({ lines: d.quote.lines, scope: d.quote.scope, terms: d.quote.terms }) !== JSON.stringify({ lines: q.lines, scope: q.scope, terms: q.terms })) {
      addHistory(d, 'Offer changed; reconfirm fit and decision criteria. Previous fit: ' + (d.facts.fit || 'not confirmed'), now);
      d.facts.fit = ''; d.facts.criterion = '';
    }
    d.quote = clone(q); addHistory(d, 'Recommendation verified against ' + q.source, now);
  }
  function accept(d, now = new Date().toISOString()) {
    const err = commitReady(d, Date.parse(now)); if (err) throw new Error(err);
    if (!d.acceptedAt) { d.acceptedAt = now; d.disposition = 'open'; addHistory(d, 'Customer accepted the verified recommendation', now); }
  }
  function authorize(d, now = new Date().toISOString()) {
    const err = commitReady(d, Date.parse(now)); if (err) throw new Error(err);
    if (!d.acceptedAt) throw new Error('Record the customer’s agreement first.');
    if (!d.authorizedAt) { d.authorizedAt = now; addHistory(d, 'Customer payment authorization recorded; no charge made by Revenue Desk', now); }
  }
  function recordPayment(w, d, input, now = new Date().toISOString()) {
    if (!d.authorizedAt) throw new Error('Record agreement and payment authorization first.');
    const reference = text(input.reference);
    if (!reference || !input.confirmed) throw new Error('Confirm successful payment in the approved system and enter its transaction reference.');
    if (!Number.isSafeInteger(input.amount) || input.amount <= 0 || input.amount > 100000000) throw new Error('Enter the actual amount collected.');
    if (w.events.some(e => e.type === 'payment' && e.reference.toLowerCase() === reference.toLowerCase())) throw new Error('This transaction reference is already recorded.');
    const event = { id: uid(), dealId: d.id, type: 'payment', amount: input.amount, reference, at: now, source: 'rep-confirmed', contract: contractTotal(d.quote), quote: clone(d.quote) };
    w.events.push(event); d.disposition = 'open';
    if (d.task && d.task.kind === 'payment') d.task.done = true;
    addHistory(d, 'Payment confirmed: ' + money(input.amount) + ' · ' + reference, now);
    return event;
  }
  function recordRefund(w, d, input, now = new Date().toISOString()) {
    const payment = w.events.find(e => e.id === input.paymentId && e.dealId === d.id && e.type === 'payment');
    if (!payment) throw new Error('Select the original payment.');
    if (!text(input.reference) || !input.confirmed) throw new Error('Confirm the refund in the approved system and enter its reference.');
    if (w.events.some(e => e.type === 'refund' && e.reference.toLowerCase() === text(input.reference).toLowerCase())) throw new Error('This refund reference is already recorded.');
    const refunded = w.events.filter(e => e.type === 'refund' && e.paymentId === payment.id).reduce((s, e) => s + e.amount, 0);
    if (!Number.isSafeInteger(input.amount) || input.amount <= 0 || input.amount > payment.amount - refunded) throw new Error('Refund exceeds the remaining collected amount.');
    w.events.push({ id: uid(), dealId: d.id, type: 'refund', amount: input.amount, paymentId: payment.id, reference: text(input.reference), at: now, source: 'rep-confirmed' });
    if (netPaid(w, d.id) === 0) { d.activatedAt = null; if (d.task) d.task.done = true; }
    addHistory(d, 'Refund confirmed: ' + money(input.amount) + ' · ' + text(input.reference), now);
  }
  function activate(w, d, now = new Date().toISOString()) {
    if (netPaid(w, d.id) <= 0) throw new Error('Confirm payment before recording activation.');
    if (!d.activatedAt) { d.activatedAt = now; if (d.task && d.task.kind === 'activation') d.task.done = true; addHistory(d, 'Customer activation confirmed', now); }
  }
  function qualified(d) { return !!(text(d.facts.need) && text(d.facts.decision) && needs(d).length); }
  function startSession(w, d, now = new Date().toISOString()) {
    if (w.sessions.some(s => !s.endedAt)) throw new Error('Finish the active call before starting another.');
    if (d.doNotContact) throw new Error('This customer has asked not to be contacted.');
    const s = { id: uid(), dealId: d.id, startedAt: now, endedAt: null, seconds: 0, outcome: null, qualified: false, cohort: d.cohort };
    w.sessions.push(s); w.activeId = d.id; return s;
  }
  function endSession(w, d, outcome, now = new Date().toISOString()) {
    const s = w.sessions.find(s => !s.endedAt && s.dealId === d.id);
    if (!s) throw new Error('There is no active call for this customer.');
    if (!['connected', 'no-answer'].includes(outcome)) throw new Error('Choose the call outcome.');
    s.endedAt = now; s.seconds = Math.max(0, Math.round((Date.parse(now) - Date.parse(s.startedAt)) / 1000)); s.outcome = outcome; s.qualified = outcome === 'connected' && qualified(d);
    addHistory(d, outcome === 'connected' ? 'Conversation completed' : 'No answer', now); return s;
  }
  function action(w, d, catalog, now = Date.now()) {
    if (!d) return { kind: 'empty', phase: 'Discover', title: 'Start with a customer', question: 'Every good recommendation starts with understanding the person behind the business.', why: 'Create a deal to keep the conversation and its next steps together.' };
    if (d.doNotContact || d.disposition === 'declined') return { kind: 'closed', phase: 'Complete', title: 'Respect their decision', question: 'Thank you for being clear. I’ll leave it there.', why: 'This deal is closed. Follow up only if the customer chooses to reopen the conversation.' };
    if (grossPaid(w, d.id) && netPaid(w, d.id) === 0) return { kind: 'refunded', phase: 'Complete', title: 'Refund recorded', question: 'What would be helpful to make sure is resolved before we finish?', why: 'The refunded deal contributes no net collected cash.' };
    if (netPaid(w, d.id) > 0) return { kind: d.activatedAt ? 'complete' : 'activate', phase: 'Activate', title: d.activatedAt ? 'Close the loop' : 'Make the first step happen', question: d.activatedAt ? 'What questions can I help with before we finish?' : 'Let’s get your first step completed together. Are you able to open your dashboard?', why: d.activatedAt ? 'Payment and activation are confirmed. Leave a clear recap.' : 'Confirm the actual activation or first appointment in the service system.' };
    if (d.objection && !d.objection.resolved) return { kind: 'objection', phase: 'Clarify', title: d.objection.clarification ? 'Address the confirmed concern' : 'Find what’s underneath the concern', question: d.objection.clarification ? 'You said ' + d.objection.clarification + '. What would you need to know or see to resolve that?' : OBJECTIONS[d.objection.category].question, why: OBJECTIONS[d.objection.category].listen };
    if (d.acceptedAt) return { kind: d.authorizedAt ? 'payment' : 'authorize', phase: 'Commit', title: d.authorizedAt ? 'Confirm the payment outcome' : 'Confirm terms and ask permission', question: d.authorizedAt ? 'Complete payment in your approved system, then record the successful transaction here.' : 'To confirm, we’re adding ' + d.quote.lines.map(l => l.name).join(' and ') + ' for ' + money(quoteTotal(d.quote)) + ' initially. ' + d.quote.terms + ' Do I have your permission to proceed?', why: 'Agreement, authorization, and a successful payment are separate milestones.' };
    if (!d.permission) return { kind: 'permission', phase: 'Open', title: 'Earn the conversation', question: 'Hi ' + (d.name.split(' ')[0] || 'there') + ', this is ' + (w.settings.repName || 'your name') + ' with ZenBusiness. I’d like to understand what you’re working on and make sure your setup supports it. Do you have about ten minutes?', why: 'Agree on the purpose and available time. If the call is recorded, give the disclosure required by your approved process.' };
    const qs = {
      need: ['Understand their priority', 'What are you most focused on getting right for the business right now?', 'Listen for their actual priority. Capture their words before suggesting a service.'],
      impact: ['Understand why it matters', 'What would getting that handled change for you or the business?', 'The importance comes from their situation and their answer.'],
      timing: ['Find the real timing', 'When would you like that in place, and what is driving that timing?', 'A specific event or an honest “no rush” gives you a useful next step.'],
      decision: ['Bring the right people in', 'How do you usually make decisions like this for the business? Does anyone else weigh in?', 'Clarify who decides and whether their agreement is available today.']
    };
    for (const k of (d.rushed ? ['need', 'timing', 'decision'] : Object.keys(qs))) if (!text(d.facts[k])) return { kind: 'evidence', key: k, phase: 'Discover', title: qs[k][0], question: qs[k][1], why: qs[k][2] };
    if (unknowns(d).length) return { kind: 'coverage', phase: 'Discover', title: 'Verify what is already covered', question: 'What help do you already have with ' + unknowns(d).map(k => SERVICES[k].toLowerCase()).join(', ') + '?', why: 'Unknown coverage is a question to ask. Mark an opportunity only after confirming the gap.' };
    const rec = recommendation(d, catalog);
    if (!rec) return { kind: 'covered', phase: 'Complete', title: 'Their current setup may be enough', question: 'It sounds like you have these pieces handled. Is there anything else you wanted to work through today?', why: 'No confirmed uncovered service matches this lane. Check a different priority only if the customer raises it.' };
    if (!d.quote || !quoteValid(d.quote, now) || !quoteCompatible(d)) return { kind: 'offer', phase: 'Recommend', title: 'Build one relevant recommendation', question: 'You said “' + d.facts.need + '”. Based on the gaps we confirmed, I’d like to walk you through an option that addresses that.', why: 'Verify ' + rec.name + ' against the current account, approved pricing, and service scope before quoting.' };
    if (!text(d.facts.fit)) return { kind: 'evidence', key: 'fit', phase: 'Recommend', title: 'Check the fit in their words', question: 'How well does that address what you wanted to get handled? What is still missing?', why: 'Listen for a real fit, a partial fit, or a mismatch. Record the answer.' };
    if (!text(d.facts.criterion)) return { kind: 'evidence', key: 'criterion', phase: 'Recommend', title: 'Make the decision clear', question: 'What else would you need to feel comfortable making a decision?', why: 'Invite questions about the scope, cost, terms, timing, or approval.' };
    if (d.decisionType === 'unknown' || (d.decisionType === 'shared' && !d.decisionReady)) return { kind: 'decision', phase: 'Commit', title: 'Include the decision-maker', question: 'Would a short conversation together be helpful so everyone can get their questions answered?', why: 'Confirm the approval path, or agree on a specific conversation with the necessary people.' };
    return { kind: 'accept', phase: 'Commit', title: 'Ask clearly. Give them room.', question: 'Based on what you wanted to solve, I recommend ' + d.quote.lines.map(l => l.name).join(' and ') + '. The initial amount is ' + money(quoteTotal(d.quote)) + '. ' + d.quote.terms + ' Would you like to get that started?', why: 'Ask once, then listen. Record their actual decision.' };
  }
  function queue(w, now = Date.now()) {
    return w.deals.filter(d => !d.doNotContact && d.disposition !== 'declined' && !(grossPaid(w, d.id) && netPaid(w, d.id) === 0) && !(d.activatedAt && (!d.task || d.task.done))).map(d => {
      const task = d.task && !d.task.done ? d.task : null;
      const due = task && Date.parse(task.at);
      let score = 20, reason = 'New conversation', label = 'Ready when you are';
      if (task && due <= now) { score = task.confirmed ? 100 : 90; reason = task.confirmed ? 'Agreed callback due' : 'Your follow-up task is due'; label = 'Due now'; }
      else if (task) { score = 10; reason = task.purpose; label = task.confirmed ? 'Callback scheduled' : 'Task scheduled'; }
      else if (netPaid(w, d.id) > 0 && !d.activatedAt) { score = 75; reason = 'Help them activate'; label = 'Activation pending'; }
      else if (d.authorizedAt || d.acceptedAt) { score = 70; reason = 'Confirm the purchase outcome'; label = 'Payment pending'; }
      else if (d.objection && !d.objection.resolved) { score = 50; reason = 'Resolve ' + OBJECTIONS[d.objection.category].label.toLowerCase(); label = 'Next step needed'; }
      else if (text(d.facts.need)) { score = 40; reason = 'Continue the conversation'; label = 'Next step needed'; }
      return { deal: d, task, score, reason, label };
    }).sort((a, b) => b.score - a.score || (Date.parse(a.task?.at || a.deal.createdAt) - Date.parse(b.task?.at || b.deal.createdAt)));
  }
  function dayKey(at, zone) {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(at));
    const p = Object.fromEntries(parts.map(x => [x.type, x.value])); return p.year + '-' + p.month + '-' + p.day;
  }
  function metrics(w, { from = '', to = '9999-12-31', cohort = 'all', zone = w.settings.timeZone } = {}) {
    const inRange = at => !!at && dayKey(at, zone) >= from && dayKey(at, zone) <= to;
    const ids = new Set(w.deals.filter(d => cohort === 'all' || d.cohort === cohort).map(d => d.id));
    const ev = w.events.filter(e => ids.has(e.dealId) && inRange(e.at));
    const payments = ev.filter(e => e.type === 'payment'), refundEvents = ev.filter(e => e.type === 'refund');
    const calls = w.sessions.filter(s => ids.has(s.dealId) && s.endedAt && inRange(s.endedAt));
    const connected = calls.filter(s => s.outcome === 'connected'), qualifiedIds = new Set(calls.filter(s => s.qualified).map(s => s.dealId));
    const paidIds = new Set(payments.map(e => e.dealId));
    const converted = [...qualifiedIds].filter(id => paidIds.has(id)).length;
    const firstByDeal = new Map();
    for (const e of w.events) if (e.type === 'payment' && (!firstByDeal.has(e.dealId) || Date.parse(e.at) < Date.parse(firstByDeal.get(e.dealId).at))) firstByDeal.set(e.dealId, e);
    const firstPayments = payments.filter(e => firstByDeal.get(e.dealId).id === e.id);
    const newPaidDeals = new Set(firstPayments.map(e => e.dealId)).size;
    const retained = [...new Set(firstPayments.map(e => e.dealId))].filter(id => netPaid(w, id) > 0).length;
    const cash = payments.reduce((s, e) => s + e.amount, 0), returned = refundEvents.reduce((s, e) => s + e.amount, 0);
    const seconds = calls.reduce((s, c) => s + c.seconds, 0);
    const activated = w.deals.filter(d => ids.has(d.id) && inRange(d.activatedAt)).length;
    const followIds = new Set(w.deals.filter(d => ids.has(d.id) && d.history.some(h => h.message === 'Customer agreed to follow-up' && inRange(h.at))).map(d => d.id));
    return { calls: calls.length, connected: connected.length, qualified: qualifiedIds.size, converted, closeRate: qualifiedIds.size ? converted / qualifiedIds.size : null, newPaidDeals, retained, paidAccounts: paidIds.size, cash, refunds: returned, net: cash - returned, hours: seconds / 3600, dealsPerHour: seconds ? newPaidDeals / (seconds / 3600) : null, revenuePerDeal: newPaidDeals ? firstPayments.reduce((s, e) => s + e.amount, 0) / newPaidDeals : null, activated, followUps: followIds.size, followConverted: [...followIds].filter(id => paidIds.has(id)).length, refundTransactions: refundEvents.length };
  }
  function coaching(d) {
    if (!text(d.facts.decision)) return { title: 'Bring the decision-maker in earlier', detail: 'The decision process is still unknown.', drill: OBJECTIONS.authority.drill };
    if (!text(d.facts.impact)) return { title: 'Explore the impact', detail: 'You have a need, but its importance is still unclear.', drill: 'Ask what changes for the business if the issue is resolved. Listen without supplying the answer.' };
    if (d.objection && !d.objection.resolved) return { title: 'Practice the unresolved concern', detail: OBJECTIONS[d.objection.category].label, drill: OBJECTIONS[d.objection.category].drill };
    if (!d.task && !d.acceptedAt && d.disposition === 'open') return { title: 'Leave a clear next step', detail: 'This conversation has no decision or next event.', drill: 'Ask whether a follow-up would help. Agree on its purpose, participants, and time.' };
    return { title: 'Make the recommendation concise', detail: 'Connect one service to one confirmed customer priority.', drill: 'Practice a twenty-second recommendation: their need, the relevant service, verified terms, and a clear question.' };
  }
  function recap(w, d) {
    const active = w.sessions.find(s => !s.endedAt && s.dealId === d.id);
    return ['REVENUE DESK · ' + d.name + ' · ' + d.business, 'Status: ' + status(w, d) + (active ? ' · call in progress' : ''), 'Source: ' + d.source + ' · workflow: ' + d.cohort, '', 'BUYER EVIDENCE', ...Object.entries(FACTS).map(([k, label]) => label + ': ' + (d.facts[k] || 'Not confirmed')), 'Decision process: ' + d.decisionType + (d.decisionType === 'shared' ? (d.decisionReady ? ' · approval confirmed' : ' · approval pending') : ''), '', 'COVERAGE', ...Object.entries(SERVICES).map(([k, label]) => label + ': ' + d.coverage[k] + (d.coverageNotes[k] ? ' · ' + d.coverageNotes[k] : '')), '', 'RECOMMENDATION', d.quote ? d.quote.lines.map(l => l.name + ' · ' + money(l.amount) + ' / ' + l.billing).join('\n') + '\nScope: ' + d.quote.scope + '\nTerms: ' + d.quote.terms + '\nVerified source: ' + d.quote.source + '\nVerified at: ' + d.quote.verifiedAt + '\nContract value: ' + money(contractTotal(d.quote)) : 'No verified offer', 'Accepted: ' + (d.acceptedAt || 'No'), 'Authorized: ' + (d.authorizedAt || 'No'), 'Net collected: ' + money(netPaid(w, d.id)), 'Activated: ' + (d.activatedAt || 'No'), '', 'OPEN CONCERN', d.objection ? d.objection.quote + '\nClarification: ' + (d.objection.clarification || 'Not yet clarified') + '\nResolution: ' + (d.objection.resolved ? d.objection.resolution : 'Unresolved') : 'None recorded', '', 'NEXT STEP', d.task ? d.task.purpose + '\nWhen: ' + d.task.at + '\nOwner: ' + d.task.owner + '\nCustomer agreed: ' + (d.task.confirmed ? 'Yes' : 'Not confirmed') + '\nCompleted: ' + (d.task.done ? 'Yes' : 'No') : 'No next step scheduled', 'Contact preference: ' + (d.doNotContact ? 'Do not contact' : 'No restriction recorded'), '', 'NOTES', d.notes || 'None'].join('\n');
  }
  function email(w, d) {
    const lines = ['Subject: Next steps for ' + (d.business || 'your business'), '', 'Hi ' + (d.name.split(' ')[0] || 'there') + ',', '', 'Thank you for speaking with me.'];
    if (d.facts.need) lines.push('You mentioned that your priority is: ' + d.facts.need + '.');
    if (d.objection && !d.objection.resolved) lines.push('The question we still need to work through is: ' + d.objection.quote + '.');
    if (d.quote && quoteValid(d.quote)) lines.push('', 'The option we discussed is ' + d.quote.lines.map(l => l.name).join(' and ') + '.', d.quote.scope, 'Initial amount: ' + money(quoteTotal(d.quote)) + '. ' + d.quote.terms);
    if (d.task && !d.task.done) lines.push('', (d.task.confirmed ? 'Our agreed next step: ' : 'Proposed next step: ') + d.task.purpose + '.', new Intl.DateTimeFormat('en-US', { dateStyle: 'full', timeStyle: 'short', timeZone: w.settings.timeZone }).format(new Date(d.task.at)) + ' (' + w.settings.timeZone + ').');
    lines.push('', 'Please let me know if anything changes or if you have another question.', '', w.settings.repName || 'Your name', 'ZenBusiness'); return lines.join('\n');
  }
  function migrateLegacy(raw) {
    const w = workspace(); if (!raw || typeof raw !== 'object' || !raw.f) return w;
    const f = raw.f, n = raw.n || {};
    w.settings.repName = text(f.repName);
    if (!text(f.customerName) && !text(f.businessName)) return w;
    const d = deal({ name: f.customerName, business: f.businessName, email: f.email, phone: f.phone, industry: f.businessType, entity: f.entityType, source: 'Previous Revenue Desk', cohort: 'baseline' });
    d.facts.need = text(n.priority) || text(n.worry); d.facts.impact = text(n.consequence); d.facts.timing = text(n.timeline); d.facts.decision = text(n.decider); d.notes = 'Imported previous call. Previous cart totals were not treated as paid revenue.\n' + (raw._recap || '');
    for (const [key, old] of Object.entries({ planning: 'qtp', filing: 'btp', books: 'mp', ein: 'ein', agreement: 'oaHas', licenses: 'blrHas', website: 'web' })) d.coverage[key] = f[old] === 'y' ? 'covered' : f[old] === 'n' ? 'gap' : 'unknown';
    d.coverage.agent = ['zb', 'other'].includes(f.raStatus) ? 'covered' : 'unknown';
    addHistory(d, 'Previous call imported as an unverified draft. Payment history was not inferred.');
    w.deals.push(d); w.activeId = d.id; return w;
  }
  function validateWorkspace(input) {
    if (!input || input.version !== VERSION || !Array.isArray(input.deals) || !Array.isArray(input.events) || !Array.isArray(input.sessions) || !input.settings) throw new Error('Choose a Revenue Desk v3 backup.');
    if (input.deals.length > 10000 || input.events.length > 100000 || input.sessions.length > 100000) throw new Error('The backup is too large.');
    const w = clone(input), ids = new Set(), eventIds = new Set(), refs = new Set();
    if (!Number.isInteger(w.revision) || w.revision < 0 || typeof w.settings.repName !== 'string' || !Number.isInteger(w.settings.targetDeals) || w.settings.targetDeals < 1 || w.settings.targetDeals > 1000) throw new Error('Invalid workspace settings.');
    try { new Intl.DateTimeFormat('en', { timeZone: w.settings.timeZone }); } catch (_) { throw new Error('Invalid reporting time zone.'); }
    const validDate = x => typeof x === 'string' && Number.isFinite(Date.parse(x));
    for (const d of w.deals) {
      if (typeof d.id !== 'string' || !d.id || ids.has(d.id) || typeof d.name !== 'string' || typeof d.business !== 'string' || !d.facts || !d.coverage || !Array.isArray(d.history) || !validDate(d.createdAt) || !validDate(d.updatedAt) || !LANES[d.lane]) throw new Error('Invalid or duplicate deal in backup.');
      ids.add(d.id);
      if (!['unknown', 'solo', 'shared'].includes(d.decisionType) || !['open', 'deferred', 'declined'].includes(d.disposition) || !['adaptive', 'baseline'].includes(d.cohort)) throw new Error('Invalid deal state.');
      for (const k of ['email', 'phone', 'industry', 'entity', 'source', 'notes', 'lossReason']) if (typeof d[k] !== 'string') throw new Error('Invalid customer details.');
      for (const k of ['permission', 'rushed', 'decisionReady', 'doNotContact']) if (typeof d[k] !== 'boolean') throw new Error('Invalid customer confirmation.');
      for (const k of ['acceptedAt', 'authorizedAt', 'activatedAt']) if (d[k] !== null && !validDate(d[k])) throw new Error('Invalid milestone date.');
      if (d.history.some(e => !validDate(e.at) || typeof e.message !== 'string')) throw new Error('Invalid deal timeline.');
      for (const k of Object.keys(FACTS)) if (typeof d.facts[k] !== 'string') throw new Error('Invalid buyer evidence.');
      for (const k of Object.keys(SERVICES)) if (!['unknown', 'covered', 'gap', 'na'].includes(d.coverage[k])) throw new Error('Invalid coverage state.');
      if (d.task && (!validDate(d.task.at) || typeof d.task.purpose !== 'string' || typeof d.task.owner !== 'string' || typeof d.task.confirmed !== 'boolean' || typeof d.task.done !== 'boolean' || !['callback', 'promise', 'decision', 'payment', 'activation'].includes(d.task.kind))) throw new Error('Invalid follow-up date or details.');
      if (d.objection && (!OBJECTIONS[d.objection.category] || ['quote', 'clarification', 'resolution'].some(k => typeof d.objection[k] !== 'string') || typeof d.objection.resolved !== 'boolean')) throw new Error('Invalid objection category or details.');
      if (d.quote && (!Array.isArray(d.quote.lines) || !d.quote.lines.length || d.quote.lines.some(l => typeof l.name !== 'string' || typeof l.productId !== 'string' || !Number.isSafeInteger(l.amount) || l.amount <= 0 || !Array.isArray(l.services) || !l.services.length || l.services.some(k => !SERVICES[k]) || !['annual', 'monthly', 'once'].includes(l.billing) || !Number.isInteger(l.months) || l.months < 1 || l.months > 60))) throw new Error('Invalid offer in backup.');
      d.coverageNotes = d.coverageNotes || {};
      if (d.quote && (!validDate(d.quote.verifiedAt) || !validDate(d.quote.expiresAt) || ['source', 'scope', 'terms'].some(k => typeof d.quote[k] !== 'string'))) throw new Error('Invalid quote verification.');
    }
    for (const e of w.events) {
      const ref = e.type + ':' + text(e.reference).toLowerCase();
      if (!ids.has(e.dealId) || !['payment', 'refund'].includes(e.type) || !Number.isSafeInteger(e.amount) || e.amount <= 0 || e.amount > 100000000 || !validDate(e.at) || !text(e.reference) || refs.has(ref) || !e.id || eventIds.has(e.id)) throw new Error('Invalid or duplicate transaction in backup.');
      eventIds.add(e.id); refs.add(ref);
    }
    for (const e of w.events.filter(e => e.type === 'refund')) {
      const p = w.events.find(p => p.id === e.paymentId && p.type === 'payment' && p.dealId === e.dealId);
      if (!p || w.events.filter(r => r.type === 'refund' && r.paymentId === p.id).reduce((s, r) => s + r.amount, 0) > p.amount) throw new Error('Refund history exceeds its payment.');
    }
    for (const s of w.sessions) if (!ids.has(s.dealId) || !validDate(s.startedAt) || (s.endedAt && !validDate(s.endedAt)) || !Number.isFinite(s.seconds) || s.seconds < 0) throw new Error('Invalid call history.');
    if (w.sessions.filter(s => !s.endedAt).length > 1) throw new Error('Backup contains more than one active call.');
    w.activeId = ids.has(w.activeId) ? w.activeId : null; return w;
  }
  return { VERSION, SERVICES, FACTS, LANES, OBJECTIONS, uid, clone, money, cents, workspace, deal, addHistory, needs, unknowns, recommendation, quoteTotal, contractTotal, quoteValid, quoteCompatible, commitReady, saveQuote, accept, authorize, recordPayment, recordRefund, activate, paymentEvents, grossPaid, netPaid, refunds, status, qualified, startSession, endSession, action, queue, dayKey, metrics, coaching, recap, email, migrateLegacy, validateWorkspace };
});
