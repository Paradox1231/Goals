import {done, count, ready, ordered, move, toggle} from './model.js';
const app = document.querySelector('#app'), sheet = document.querySelector('#sheet');
const key = 'summit-goals-v1';
const initial = () => ({goals:[], theme:'light', accent:'#22713e'});
const read = () => JSON.parse(localStorage.getItem(key) || 'null') || initial();
let state;
try { state = read(); } catch { app.textContent='Your saved goals could not be opened. Reload to try again.'; throw Error('Local storage unavailable'); }
let tab='active', expanded=new Set(), drag=null;
const esc = v => String(v ?? '').replace(/[&<>"']/g, k => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[k]));
const uid = () => crypto.randomUUID();
const screen = () => location.hash.slice(1);
const goal = () => state.goals.find(g=>g.id===screen());
const icons={plus:'<path d="M12 5v14M5 12h14"/>',gear:'<path d="m10 3 .5-1h3l.5 2 2 1 2-.5 1.5 2.6-1.3 1.5v2.5l1.3 1.5-1.5 2.6-2-.5-2 1-.5 2h-3l-.5-2-2-1-2 .5L4.5 13l1.3-1.5V9L4.5 7.5 6 4.9l2 .5 2-1Z" transform="translate(0 2)"/><circle cx="12" cy="12" r="3"/>',grip:'<g fill="currentColor" stroke="none"><circle cx="8" cy="5" r="2"/><circle cx="16" cy="5" r="2"/><circle cx="8" cy="12" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="8" cy="19" r="2"/><circle cx="16" cy="19" r="2"/></g>',back:'<path d="m14 5-7 7 7 7"/>',down:'<path d="m5 9 7 7 7-7"/>',up:'<path d="m5 15 7-7 7 7"/>',check:'<path d="m5 12 4 4 10-10"/>',edit:'<path d="m4 20 1-6L16 3l5 5-11 11-6 1ZM14 5l5 5"/>'};
const svg=(k,c='')=>'<svg class="'+c+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+icons[k]+'</svg>';
function btn(action,label,body,cls='',attrs=''){return '<button type="button" data-a="'+action+'" class="'+cls+'" aria-label="'+esc(label)+'" '+attrs+'>'+body+'</button>';}
const idattr=id=>'data-id="'+esc(id)+'"';
const back=()=>btn('back','Back to My goals',svg('back')+'My goals','back');
const flags=(g)=>count(g)+' of '+g.milestones.length+' milestones complete';
const bar=g=>'<span class="bar" aria-hidden="true"><i style="width:'+(g.milestones.length?100*count(g)/g.milestones.length:0)+'%"></i></span>';
const note=n=>n?'<p class="note">'+esc(n)+'</p>':'';
const date=d=>d?'<span class="date">Target '+esc(new Intl.DateTimeFormat('en-AU',{day:'numeric',month:'short',year:'numeric'}).format(new Date(d+'T12:00:00')))+'</span>':'';
const check=(isDone,label,action,attrs)=>btn(action,label,'<span>'+(isDone?svg('check'):'')+'</span>','check '+(isDone?'on':''),attrs+' aria-pressed="'+isDone+'"');
const grip=(id,name)=>btn('reorder','Reorder '+name,svg('grip'),'grip',idattr(id)+' title="Drag to reorder, or tap for options"');
function alertUser(message){const n=document.querySelector('#notice');n.textContent=message;clearTimeout(alertUser.timer);alertUser.timer=setTimeout(()=>n.textContent='',4000);}
function colours(){
 const root=document.documentElement;root.dataset.theme=state.theme;
 const hex=state.accent;
 const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4);
 const lum=.2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];
 root.style.setProperty('--accent',hex);root.style.setProperty('--ink',lum>.179?'#090909':'#fff');
 document.querySelector('[name=theme-color]').content=state.theme==='dark'?'#101112':'#ffffff';
}
function persist(){
 try {localStorage.setItem(key,JSON.stringify(state));return true;}
 catch {try{state=read();}catch{}render();alertUser('Could not save this change on your device.');return false;}
}
function home(){
 const active=tab==='active', list=state.goals.filter(g=>g.finished!==active);
 return '<header class="header"><h1>My goals</h1><div class="actions">'+btn('settings','Settings',svg('gear'),'icon')+btn('newGoal','Add goal',svg('plus'),'icon round')+'</div></header><nav class="tabs" aria-label="Goal lists">'+['active','completed'].map(t=>btn(t,t,t==='active'?'Active':'Completed',t===tab?'selected':'','aria-pressed="'+(t===tab)+'"')).join('')+'</nav>'+
 (list.length?list.map(g=>'<article class="item row" data-key="'+g.id+'">'+btn('open',g.title,'<span class="title">'+esc(g.title)+'</span><span class="sub">'+(g.milestones.length?flags(g):'No milestones yet')+'</span>'+bar(g),'mainrow',idattr(g.id))+(active?grip(g.id,g.title):'')+'</article>').join(''):
 '<div class="empty"><img src="./icon-180.png" alt=""><h2>'+(active?'Your first goal starts here':'No completed goals yet')+'</h2><p>'+(active?'Give it a title. Add milestones when you’re ready.':'Finished goals will appear here.')+'</p>'+(active?btn('newGoal','Add your first goal','Add your first goal','primary'):'')+'</div>');
}
function milestone(m,g){
 const show=expanded.has(m.id), attrs=idattr(m.id);
 const status=m.steps.length?m.steps.filter(s=>s.done).length+' of '+m.steps.length+' steps':'';
 const toggleLabel=done(m)?'Uncheck ':'Complete ';
 const control=m.steps.length?btn('expand','View steps for '+m.title,'<span>'+(done(m)?svg('check'):'')+'</span>','check '+(done(m)?'on':''),attrs):check(done(m),toggleLabel+m.title,'tick',attrs);
 return '<article class="item milestone" data-key="'+m.id+'"><div class="row">'+control+
 btn('expand',m.title,'<span class="title">'+esc(m.title)+' '+svg(show?'up':'down','chev')+'</span>'+(status?'<span class="sub">'+status+'</span>':'')+date(m.date),'mainrow',attrs+' aria-expanded="'+show+'"')+
 (!done(m)?grip(m.id,m.title):'')+'</div>'+
 (show?'<div class="steps">'+note(m.note)+m.steps.map(s=>'<div class="step '+(s.done?'done':'')+'">'+check(s.done,(s.done?'Uncheck ':'Complete ')+s.title,'tick',attrs+' data-step="'+s.id+'"')+btn('editStep','Edit '+s.title,esc(s.title)+date(s.date),'mainrow',attrs+' data-step="'+s.id+'"')+'</div>').join('')+'<div class="links">'+btn('newStep','Add step','+ Add step','',attrs)+btn('editMilestone','Edit milestone','Edit milestone','',attrs)+'</div></div>':'')+'</article>';
}
function detail(g){return back()+'<header class="header"><h1>'+esc(g.title)+'</h1>'+btn('editGoal','Edit goal',svg('edit'),'icon')+'</header><div class="sub">'+flags(g)+'</div>'+bar(g)+date(g.date)+note(g.note)+'<div class="sectionhead"><h2>Milestones</h2>'+btn('newMilestone','Add milestone',svg('plus'),'icon')+'</div>'+ordered(g).map(m=>milestone(m,g)).join('')+
 (!g.milestones.length?'<div class="empty smallbox"><p>Add your first milestone to start tracking progress.</p>'+btn('newMilestone','Add first milestone','Add milestone','secondary')+'</div>':'')+
 (!g.finished&&ready(g)?'<div class="ready">'+btn('finishPrompt','Finish goal','Finish goal','primary')+'</div>':'');}
const palette=['#22713e','#b59aff','#f28bbd','#ee745b','#f7b54a','#36baa4','#6da9f4','#78818c'];
function settings(){return back()+'<header class="header"><h1>Settings</h1></header><section class="options"><h2>Appearance</h2>'+['light','dark'].map(t=>btn('theme',t,t[0].toUpperCase()+t.slice(1)+'<b>'+(state.theme===t?'✓':'')+'</b>','option','data-value="'+t+'" aria-pressed="'+(state.theme===t)+'"')).join('')+'</section><section class="options"><h2>Accent colour</h2><div class="swatches">'+palette.map(c=>btn('accent','Use '+c,'','swatch','style="background:'+c+'" data-value="'+c+'" aria-pressed="'+(c===state.accent)+'"')).join('')+'</div><p class="caption">Custom colour</p><div class="fieldline"><input id="picker" type="color" aria-label="Custom colour picker" value="'+state.accent+'"><input id="hex" aria-label="Hex colour" type="text" maxlength="7" spellcheck="false" autocapitalize="none" value="'+state.accent.toUpperCase()+'">'+btn('hex','Apply hex colour','Apply','secondary')+'</div></section>';}
function render(){colours();app.innerHTML=screen()==='settings'?settings():goal()?detail(goal()):home();}
function navigate(id){expanded.clear();location.hash=id;window.scrollTo(0,0);}
window.addEventListener('hashchange',()=>{expanded.clear();render();window.scrollTo(0,0);});
window.addEventListener('storage',e=>{if(e.key===key){sheet.close();state=read();render();}});
function modal(html){if(sheet.open)sheet.close();sheet.innerHTML=html;sheet.setAttribute('aria-labelledby','dialog-title');sheet.showModal();}
function ask(title,body,choices){
 modal('<h2 id="dialog-title">'+esc(title)+'</h2><p>'+esc(body)+'</p><div class="actions">'+choices.map(([label],i)=>btn('answer',label,esc(label),i===choices.length-1?'primary':'secondary','data-index="'+i+'"')).join('')+'</div>');
 sheet.onclick=e=>{const b=e.target.closest('[data-index]');if(!b)return;sheet.close();choices[Number(b.dataset.index)][1]();};
}
function finish(g){ask('All milestones complete','Finish this goal or add another milestone?',[['Add another milestone',()=>editor('milestone',g)],['Finish goal',()=>{if(!ready(g))return;g.finished=true;if(persist()){tab='completed';navigate('');render();}}]]);}
function changed(g,wasReady){if(!persist())return;render();if(!g.finished&&!wasReady&&ready(g))finish(g);}
function allowReopen(g,commit){
 if(!g.finished){commit();return;}
 ask('Reopen this goal?','This change will move the goal back to Active.',[['Cancel',()=>{}],['Reopen goal',()=>{g.finished=false;tab='active';commit();}]]);
}
function editor(kind,g,m,s){
 const obj=kind==='goal'?g:kind==='milestone'?m:s;
 const title=(obj?'Edit ':'New ')+kind;
 modal('<form><h2 id="dialog-title">'+title+'</h2><label for="entryTitle">Title</label><input id="entryTitle" name="title" required autofocus maxlength="240" placeholder="'+(kind==='goal'?'What would you like to achieve?':'Name this '+kind)+'"><label for="entryDate">Target date (optional)</label><input id="entryDate" name="date" type="date">'+(kind==='step'?'':'<label for="entryNote">Notes (optional)</label><textarea id="entryNote" name="note" rows="3"></textarea>')+'<div class="actions">'+(obj?btn('delete','Delete '+kind,'Delete','danger')+'<i class="spacer"></i>':'')+btn('cancel','Cancel','Cancel','secondary')+'<button class="primary" type="submit">Save</button></div></form>');
 const form=sheet.querySelector('form');form.elements.title.value=obj?.title||'';form.elements.date.value=obj?.date||'';if(form.elements.note)form.elements.note.value=obj?.note||'';
 const wasReady=g&&ready(g);
 sheet.onclick=e=>{const a=e.target.closest('button')?.dataset.a;if(a==='cancel')sheet.close();
 if(a==='delete'){sheet.close();ask('Delete '+kind+'?','“'+obj.title+'”'+(kind==='step'?'':' and its contents')+' will be removed.',[['Cancel',()=>{}],['Delete',()=>{
 if(kind==='goal'){state.goals=state.goals.filter(x=>x.id!==g.id);if(persist()){navigate('');render();}return;}
 const apply=()=>{if(kind==='milestone')g.milestones=g.milestones.filter(x=>x.id!==m.id);else {const previouslyDone=done(m);m.steps=m.steps.filter(x=>x.id!==s.id);if(!m.steps.length)m.done=previouslyDone;}changed(g,wasReady);};
 if(g.finished&&kind==='milestone'&&g.milestones.length===1)allowReopen(g,apply);else apply();
 }]]);}};
 form.onsubmit=e=>{e.preventDefault();const fields={title:form.elements.title.value.trim(),date:form.elements.date.value};if(!fields.title){form.elements.title.focus();return;}if(kind!=='step')fields.note=form.elements.note.value.trim();
 sheet.close();
 if(obj){Object.assign(obj,fields);persist();render();return;}
 if(kind==='goal'){const item={...fields,id:uid(),milestones:[],finished:false};state.goals.push(item);if(persist()){tab='active';render();}return;}
 allowReopen(g,()=>{if(kind==='milestone')g.milestones.push({...fields,id:uid(),steps:[],done:false});
 else {m.steps.push({...fields,id:uid(),done:false});expanded.add(m.id);}changed(g,wasReady);});
 };
}
function sortables(){const g=goal();return g?ordered(g).filter(m=>!done(m)):state.goals.filter(g=>!g.finished);}
function reorder(id,target){const list=goal()?.milestones||state.goals;move(list,id,target);persist();render();}
function moveMenu(id){const list=sortables(),idx=list.findIndex(x=>x.id===id), choices=[['Cancel',()=>{}]];
 if(idx>0)choices.push(['Move up',()=>reorder(id,list[idx-1].id)]);if(idx>=0&&idx<list.length-1)choices.push(['Move down',()=>reorder(id,list[idx+1].id)]);
 if(choices.length>1)ask('Reorder',list[idx].title,choices);else alertUser('Only one item to reorder.');}
function setAccent(c){state.accent=c.toLowerCase();persist();render();}
app.onclick=e=>{const b=e.target.closest('[data-a]');if(!b)return;const {a,id,step,value}=b.dataset,g=goal(),m=g?.milestones.find(x=>x.id===id);
 switch(a){
 case 'settings':navigate('settings');break;
 case 'back':navigate('');break;
 case 'open':navigate(id);break;
 case 'active':case 'completed':tab=a;render();break;
 case 'newGoal':editor('goal');break;case 'editGoal':editor('goal',g);break;
 case 'newMilestone':editor('milestone',g);break;case 'editMilestone':editor('milestone',g,m);break;
 case 'newStep':editor('step',g,m);break;case 'editStep':editor('step',g,m,m.steps.find(s=>s.id===step));break;
 case 'expand':if(expanded.has(id))expanded.delete(id);else expanded.add(id);render();break;
 case 'tick':{const prev=ready(g);allowReopen(g,()=>{toggle(m,step);changed(g,prev);});break;}
 case 'finishPrompt':if(ready(g))finish(g);break;
 case 'reorder':if(performance.now()>suppressClickUntil)moveMenu(id);break;
 case 'theme':state.theme=value;persist();render();break;
 case 'accent':setAccent(value);break;
 case 'hex':{const input=app.querySelector('#hex'),v=input.value.trim().replace(/^#/,'');if(/^[0-9a-f]{6}$/i.test(v))setAccent('#'+v);else{input.focus();alertUser('Enter a six-digit hex colour, such as #B59AFF.');}break;}
 }};
app.onchange=e=>{if(e.target.id==='picker')setAccent(e.target.value);};
app.onkeydown=e=>{if(e.key==='Enter'&&e.target.id==='hex')app.querySelector('[data-a=hex]').click();};
let suppressClickUntil=0;
app.onpointerdown=e=>{const b=e.target.closest('.grip');if(!b||e.button!==0)return;b.setPointerCapture(e.pointerId);drag={id:b.dataset.id,y:e.clientY,p:e.pointerId,moved:false,target:null};};
app.onpointermove=e=>{if(!drag||e.pointerId!==drag.p||Math.abs(e.clientY-drag.y)<5&&!drag.moved)return;drag.moved=true;
 if(e.clientY<65)window.scrollBy(0,-15);else if(e.clientY>innerHeight-65)window.scrollBy(0,15);
 const row=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-key]');const target=row?.dataset.key;
 app.querySelector('.drop')?.classList.remove('drop');drag.target=null;
 if(target!==drag.id&&sortables().some(x=>x.id===target)){row.classList.add('drop');drag.target=target;}
};
app.onpointerup=e=>{if(!drag||e.pointerId!==drag.p)return;const d=drag;drag=null;if(d.moved){suppressClickUntil=performance.now()+450;if(d.target)reorder(d.id,d.target);else render();}};
app.onpointercancel=()=>{drag=null;app.querySelector('.drop')?.classList.remove('drop');};
render();
if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
