'use strict';
// Integration tests exercise the real application event handlers in a minimal DOM
// harness. These complement domain tests; they are not visual browser tests.
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const KEY='revdesk:v3:workspace',DK='revdesk:v3:practice';
function harness(storage=new Map(),bundle=false){
 const listeners={},nodes=new Map();
 class Node{constructor(){this.innerHTML='';this.textContent='';this.value='';this.hidden=false;this.open=false;this.dataset={};this.classList={add(){},remove(){},toggle(){}};}focus(){}select(){}setSelectionRange(){}scrollIntoView(){this.scrolled=true;}showModal(){this.open=true;}close(){this.open=false;}querySelector(selector){if(!this.children)this.children=new Map();if(!this.children.has(selector))this.children.set(selector,new Node());return this.children.get(selector);}addEventListener(){}appendChild(){}remove(){}}
 const doc={documentElement:{dataset:{theme:'dark'}},activeElement:null,title:'',getElementById(id){if(!nodes.has(id))nodes.set(id,new Node());return nodes.get(id);},querySelectorAll(){return[];},addEventListener(k,fn){(listeners[k]??=[]).push(fn);},createElement(){return new Node();},body:new Node()};
 const localStorage={getItem:k=>storage.has(k)?storage.get(k):null,setItem:(k,v)=>storage.set(k,String(v))};
 const sandbox={document:doc,localStorage,Intl,Date,Math,JSON,console,Blob,URL,crypto:require('node:crypto').webcrypto,FormData:class{constructor(el){this.values=el.values;}entries(){return Object.entries(this.values);}},navigator:{clipboard:{writeText:async()=>{}}},setTimeout:()=>1,clearTimeout(){},setInterval:()=>1,addEventListener(){}};
 sandbox.window=sandbox;vm.createContext(sandbox);
 const sources=bundle?[...fs.readFileSync(path.join(__dirname,'../revdesk-preview.html'),'utf8').matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m,i)=>['bundle-'+i,m[1]]):['core.js','data.js','desk.js','app.js'].map(file=>[file,fs.readFileSync(path.join(__dirname,'../revdesk',file),'utf8')]);
 for(const [file,source] of sources)vm.runInContext(source,sandbox,{filename:file});
 async function click(action,extra={}){const b={dataset:{action,...extra}};for(const fn of listeners.click||[])fn({target:{closest:()=>b},preventDefault(){}});await new Promise(setImmediate);}
 async function submit(kind,values={},extra={}){const el={dataset:{form:kind,...extra},values,querySelector:()=>doc.getElementById('form-error'),closest(){return this;}};for(const fn of listeners.submit||[])fn({target:el,preventDefault(){}});await new Promise(setImmediate);}
 async function input(id,value){for(const fn of listeners.input||[])fn({target:{id,value}});await new Promise(setImmediate);}
 async function key(key,options={}){for(const fn of listeners.keydown||[])fn({key,preventDefault(){},target:{id:options.id||'',closest:()=>options.typing?{}:null},...options});await new Promise(setImmediate);}
 return{storage,doc,nodes,click,submit,input,key,html:()=>doc.getElementById('app').innerHTML,state:(key=KEY)=>JSON.parse(storage.get(key)),error:()=>doc.getElementById('form-error').textContent,sandbox};
}
async function prepared(){const ui=harness();await ui.click('new-deal');assert.match(ui.doc.getElementById('dialog').innerHTML,/Customer name/);await ui.submit('deal',{name:'Sample Buyer',business:'Sample Studio',email:'buyer@example.test',phone:'',industry:'Design studio',entity:'single',source:'Test lead',cohort:'adaptive'});await ui.click('start-call');await ui.click('permission',{value:'yes'});for(const[key,answer]of Object.entries({need:'Help with planning',impact:'Focus on clients',timing:'This month',decision:'I decide'}))await ui.submit('answer',{answer,decisionType:'solo'},{key});await ui.submit('coverage',{planning:'gap',filing:'gap',books:'gap',agent:'covered',ein:'covered',agreement:'covered',licenses:'na',website:'covered'});return ui;}
test('the app boots into a real empty workspace without synthetic revenue',()=>{const ui=harness();assert.match(ui.html(),/Your next great conversation starts here/);assert.equal(ui.state().events.length,0);assert.equal(ui.state().deals.length,0);assert.doesNotMatch(ui.html(),/Northline Studio/);});
test('real UI handlers run discovery, verify, accept, authorize, collect, refund, and persist',async()=>{
 const ui=await prepared();assert.match(ui.html(),/Build one relevant recommendation/);assert.equal(ui.state().sessions.length,1);
 await ui.click('pane',{pane:'offer'});assert.match(ui.html(),/Complete Tax Bundle/);assert.match(ui.html(),/Needs price verification/);
 const expires=new Date(Date.now()+7*86400000).toISOString().slice(0,10);
 await ui.submit('quote',{productId:'bundle',billing:'monthly',amount:'199.00',months:'12',expires,scope:'Verified test scope',terms:'Twelve monthly payments. Verified renewal terms.',source:'TEST-ORDER',verified:'on'});
 assert.equal(ui.error(),'');assert.equal(ui.state().events.length,0);assert.equal(ui.state().deals[0].quote.lines[0].amount,19900);
 await ui.submit('evidence',{need:'Help with planning',impact:'Focus on clients',timing:'This month',decision:'I decide',fit:'This is the help I want',criterion:'Terms are clear',decisionType:'solo'});
 await ui.submit('accept',{confirmed:'on'});assert.equal(ui.error(),'');await ui.submit('authorize',{confirmed:'on'});assert.equal(ui.error(),'');
 await ui.submit('payment',{amount:'199.00',reference:'UI-TX-1',confirmed:'on'});assert.equal(ui.error(),'');assert.equal(ui.state().events.length,1);assert.match(ui.html(),/UI-TX-1/);
 await ui.submit('payment',{amount:'199.00',reference:'UI-TX-1',confirmed:'on'});assert.match(ui.error(),/already recorded/);assert.equal(ui.state().events.length,1);
 await ui.submit('refund',{amount:'50.00',paymentId:ui.state().events[0].id,reference:'UI-RF-1',confirmed:'on'});assert.equal(ui.error(),'');assert.equal(ui.state().events.length,2);assert.match(ui.html(),/\$149/);
 await ui.submit('activation',{detail:'Confirmed first consultation',confirmed:'on'});assert.ok(ui.state().deals[0].activatedAt);
 await ui.submit('end-call',{outcome:'connected'});assert.equal(ui.error(),'');assert.match(ui.html(),/Salesforce recap/);assert.match(ui.html(),/No CRM update has been sent/);assert.ok(ui.state().sessions[0].endedAt);
 const reloaded=harness(ui.storage);assert.equal(reloaded.state().deals[0].name,'Sample Buyer');assert.equal(reloaded.state().events.length,2);
});
test('practice and real workspaces remain isolated when switching',async()=>{const ui=harness();await ui.submit('deal',{name:'Real workspace customer',business:'Actual business',entity:'single',source:'Manual',cohort:'adaptive'});const id=ui.state().deals[0].id;await ui.click('toggle-practice');assert.match(ui.html(),/Practice workspace/);assert.equal(ui.state(DK).deals.length,5);assert.equal(ui.state().deals.length,1);await ui.click('toggle-practice');assert.equal(ui.state().deals[0].id,id);assert.equal(ui.state().events.length,0);assert.doesNotMatch(ui.html(),/Northline Studio/);});
test('declines record a reason, remove queue work, and preserve the deal',async()=>{const ui=await prepared();await ui.submit('decline',{reason:'No current need',detail:'Customer chose to stop',doNotContact:'on'});assert.equal(ui.state().deals[0].doNotContact,true);assert.equal(ui.state().deals[0].disposition,'declined');await ui.click('end-call');await ui.submit('end-call',{outcome:'connected'});await ui.click('nav',{view:'today'});assert.match(ui.html(),/Your queue is clear/);await ui.click('filter',{filter:'all'});assert.match(ui.html(),/Sample Buyer/);});
test('a malformed saved workspace is never silently overwritten',()=>{const storage=new Map([[KEY,'{broken']]);const ui=harness(storage);assert.equal(storage.get(KEY),'{broken');assert.match(ui.doc.getElementById('storage-warning').innerHTML,/left untouched/);});
test('a stale tab cannot overwrite a newer saved revision',async()=>{const ui=harness();const newer=ui.state();newer.revision+=5;newer.settings.repName='Another tab';ui.storage.set(KEY,JSON.stringify(newer));await ui.submit('deal',{name:'Unsaved draft',entity:'single',source:'Manual',cohort:'adaptive'});assert.equal(ui.state().settings.repName,'Another tab');assert.equal(ui.state().deals.length,0);assert.match(ui.doc.getElementById('storage-warning').innerHTML,/Another tab changed/);});
test('customer supplied markup is escaped in the live interface',async()=>{const ui=harness();await ui.submit('deal',{name:'<img src=x onerror=alert(1)>',business:'<script>bad()</script>',entity:'single',source:'Manual',cohort:'adaptive'});assert.ok(!ui.html().includes('<img src=x'));assert.match(ui.html(),/&lt;img/);assert.ok(!ui.html().includes('<script>bad()'));
});

test('standalone preview boots its inline scripts in practice mode without writing real records',()=>{const ui=harness(new Map(),true);assert.match(ui.html(),/Practice workspace/);assert.match(ui.html(),/Northline Studio/);assert.equal(ui.storage.has(KEY),false);assert.equal(ui.state(DK).deals.length,5);});

test('all scripts and products can be browsed without creating a customer or starting a call',async()=>{
 const ui=harness();await ui.click('nav',{view:'desk'});
 assert.equal((ui.html().match(/data-desk-section=/g)||[]).length,19);
 assert.match(ui.html(),/Every option, always available/);
 for(const section of ['payment','tax','objections','offers','open','recap']){
  await ui.click('desk-jump',{section});
  assert.equal(ui.doc.getElementById('desk-'+section).scrolled,true);
  assert.equal(ui.doc.getElementById('dialog').open,false);
 }
 assert.equal(ui.state().deals.length,0);assert.equal(ui.state().sessions.length,0);assert.equal(ui.state().events.length,0);
});

test('focus mode can jump directly to payment, products, and discovery before any evidence exists',async()=>{
 const ui=harness();await ui.submit('deal',{name:'Free navigation',entity:'single'});
 await ui.click('desk-focus-section',{section:'payment'});
 assert.equal((ui.html().match(/data-desk-section=/g)||[]).length,1);
 assert.match(ui.html(),/data-desk-section="payment"/);
 await ui.click('desk-jump',{section:'offers'});assert.match(ui.html(),/data-desk-section="offers"/);assert.match(ui.html(),/Complete Tax Bundle/);
 await ui.click('desk-jump',{section:'discovery'});assert.match(ui.html(),/data-desk-section="discovery"/);
 await ui.click('desk-mode',{mode:'all'});assert.equal((ui.html().match(/data-desk-section=/g)||[]).length,19);
 assert.equal(ui.state().deals[0].permission,false);assert.equal(ui.state().events.length,0);
});

test('notes survive rapid navigation, focus changes, and switching customers',async()=>{
 const ui=harness();await ui.submit('deal',{name:'First customer',entity:'single'});const first=ui.state().activeId;
 await ui.input('call-notes','Asked about an existing provider. Keep these exact words.');
 await ui.click('desk-jump',{section:'objections'});await ui.click('desk-focus-section',{section:'offers'});
 assert.match(ui.html(),/Asked about an existing provider/);
 await ui.submit('deal',{name:'Second customer',entity:'multi'});assert.doesNotMatch(ui.html(),/Keep these exact words/);
 await ui.input('call-notes','Second customer has a separate concern.');await ui.click('open-deal',{id:first});
 assert.match(ui.html(),/Keep these exact words/);assert.doesNotMatch(ui.html(),/Second customer has a separate concern/);
 const reloaded=harness(ui.storage);assert.equal(reloaded.state().deals.find(d=>d.id===first).notes,'Asked about an existing provider. Keep these exact words.');
});

test('command search filters section titles and synonyms, and closes when navigating',async()=>{
 const ui=harness();await ui.key('k',{ctrlKey:true});assert.equal(ui.doc.getElementById('dialog').open,true);
 await ui.input('jump-query','expensive');assert.match(ui.doc.getElementById('jump-results').innerHTML,/Objections/);assert.doesNotMatch(ui.doc.getElementById('jump-results').innerHTML,/Tax discovery/);
 await ui.click('desk-jump',{section:'objections'});assert.equal(ui.doc.getElementById('dialog').open,false);
 await ui.click('jump-search');await ui.input('jump-query','no such topic xyz');assert.match(ui.doc.getElementById('jump-results').innerHTML,/No matching section/);
});

test('keyboard shortcuts respect typing and open sections without an active deal',async()=>{
 const ui=harness();await ui.click('nav',{view:'desk'});await ui.key('f',{typing:true});assert.equal((ui.html().match(/data-desk-section=/g)||[]).length,19);
 await ui.key('f');assert.equal((ui.html().match(/data-desk-section=/g)||[]).length,1);
 await ui.key('o');assert.match(ui.html(),/data-desk-section="objections"/);
 await ui.key('p');assert.match(ui.html(),/data-desk-section="offers"/);
 await ui.key('ArrowLeft',{altKey:true});assert.match(ui.html(),/data-desk-section="website"/);
 assert.equal(ui.state().deals.length,0);
});

test('open catalog browsing does not relax quote verification or turn a selection into revenue',async()=>{
 const ui=harness();await ui.submit('deal',{name:'Unqualified customer',entity:'single'});await ui.click('desk-jump',{section:'offers'});
 await ui.click('quote',{product:'bundle'});assert.equal(ui.doc.getElementById('dialog').open,true);
 await ui.submit('quote',{productId:'bundle',billing:'annual',amount:'2038',months:'12',expires:new Date(Date.now()+7*86400000).toISOString().slice(0,10),scope:'Example scope',terms:'Example terms',source:'TEST',verified:'on'});
 assert.match(ui.error(),/confirmed gap/);assert.equal(ui.state().deals[0].quote,null);assert.equal(ui.state().events.length,0);
});

test('the coach can be hidden without hiding any call sections or changing customer facts',async()=>{
 const ui=await prepared();const before=JSON.stringify(ui.state().deals[0].facts);
 await ui.click('toggle-coach');assert.match(ui.html(),/Available whenever you want a prompt/);assert.equal((ui.html().match(/data-desk-section=/g)||[]).length,19);
 assert.equal(JSON.stringify(ui.state().deals[0].facts),before);
 await ui.click('toggle-coach');assert.match(ui.html(),/Go to suggestion/);
});

test('selecting an objection category opens that category and preserves the existing concern until saved',async()=>{
 const ui=harness(new Map(),true),before=ui.state(DK).deals[0].objection.quote;
 await ui.click('objection',{category:'authority'});assert.match(ui.doc.getElementById('dialog').innerHTML,/value="authority" selected/);
 assert.equal(ui.state(DK).deals[0].objection.quote,before);
 await ui.click('dismiss');assert.equal(ui.state(DK).deals[0].objection.quote,before);
});
