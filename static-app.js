const app = document.getElementById('app');
const toastRoot = document.getElementById('toast');
const DATA_URL = './static-data.json';
const STORAGE_KEY = 'lexiquest9-static-v1';
const MODES = {
  smart: 'هوشمند', vocabulary: 'واژگان', translation: 'ترجمه', grammar: 'گرامر',
  lesson: 'درس‌به‌درس', comprehensive: 'جامع', mistakes: 'مرور اشتباهات',
  exam: 'شبیه امتحان', challenge: 'چالش دشوار', irregular: 'افعال بی‌قاعده', reading: 'درک مطلب'
};
const DIFFICULTY = {easy:'آسان', medium:'متوسط', hard:'دشوار', expert:'چالشی', mixed:'ترکیبی'};
const STATUS = {new:'یادنگرفته', learning:'در حال یادگیری', weak:'نیازمند تمرین', mastered:'مسلط'};
let D = null;
let toastTimer = null;
let state = loadState();

function loadState(){
  const base = {
    displayName:'قهرمان', dailyGoal:10, theme:'light', view:'home', learnTab:'map', moreTab:'planner',
    filters:{q:'',lesson:'',status:'',pos:'',favorite:false}, vocabPage:0, hiddenMeanings:[],
    favorites:[], wordProgress:{}, grammarProgress:{}, attempts:[], wrongQuestionIds:[],
    activeDays:[], completedTasks:[], writing:'', writingHint:false, chat:[], quiz:null,
    result:null, quizCount:10, quizDifficulty:'mixed', quizMode:'smart', quizLesson:'', searchQuery:''
  };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return base;
    const saved = JSON.parse(raw);
    return {...base, ...saved, filters:{...base.filters,...(saved.filters||{})}};
  } catch { return base; }
}
function saveState(){
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch { toast('ذخیره‌سازی مرورگر در دسترس نیست؛ فضای ذخیره‌سازی را بررسی کن.','error'); }
}
function esc(value){return String(value ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function faNum(value){return new Intl.NumberFormat('fa-IR').format(Number(value)||0);}
function shuffle(items){const a=[...items];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function toast(message,type=''){
  const el=document.createElement('div');el.className=`toast ${type}`;el.textContent=message;toastRoot.append(el);
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>{el.style.opacity='0';el.style.transform='translateY(-8px)';setTimeout(()=>el.remove(),250);},2600);
}
function speak(text){
  if(!('speechSynthesis' in window)){toast('گفتار ماشینی در این مرورگر پشتیبانی نمی‌شود.','error');return;}
  window.speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(String(text));utterance.lang='en-US';utterance.rate=.88;window.speechSynthesis.speak(utterance);
}
function dayKey(date=new Date()){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
function wordKey(word){return `${word.lesson_id}|${word.word.toLocaleLowerCase()}`;}
function getWordProgress(word){return state.wordProgress[wordKey(word)]||{status:'new',streak:0,incorrect_count:0,reps:0,interval_days:0,due_at:null};}
function statusForWord(word){const p=getWordProgress(word);if(p.status==='mastered'&&p.due_at&&new Date(p.due_at)<=new Date())return 'learning';return p.status||'new';}
function nextVocabularyState(previous,isCorrect){
  const schedule=[1,3,7,14,30,60], old=previous||{reps:0,streak:0,incorrect_count:0};
  const next={...old,last_reviewed_at:new Date().toISOString()};
  if(isCorrect){next.reps=(Number(old.reps)||0)+1;next.streak=(Number(old.streak)||0)+1;next.interval_days=schedule[Math.min(next.streak-1,schedule.length-1)];next.status=next.streak>=3?'mastered':'learning';next.due_at=new Date(Date.now()+next.interval_days*86400000).toISOString();}
  else{next.reps=0;next.streak=0;next.incorrect_count=(Number(old.incorrect_count)||0)+1;next.interval_days=0;next.status='weak';next.due_at=new Date().toISOString();}
  return next;
}
function heading(eyebrow,title,description,extra=''){
  return `<div class="page-heading"><div><div class="eyebrow">${esc(eyebrow)}</div><h1>${title}</h1><p>${description}</p></div>${extra}</div>`;
}
function notice(){return `<div class="static-notice"><span>ℹ️</span><div><strong>نسخهٔ رایگان و مستقل</strong>این نسخه بدون سرور کار می‌کند. پیشرفت فقط در همین مرورگر ذخیره می‌شود؛ حساب کاربری، همگام‌سازی بین دستگاه‌ها و هوش مصنوعی آنلاین در این نسخه فعال نیستند. محتوای آموزشی عمومی است و هیچ اطلاعات شخصی به سایت ارسال نمی‌شود.</div></div>`;}
function navItem(view,icon,label){return `<button class="side-link ${state.view===view?'active':''}" data-action="view" data-view="${view}"><span class="nav-ico">${icon}</span>${label}</button>`;}
function mobileNav(view,icon,label){return `<button class="nav-item ${state.view===view?'active':''}" data-action="view" data-view="${view}"><span class="nav-ico">${icon}</span><span>${label}</span></button>`;}
function subnav(items,active,action){return `<div class="static-subnav">${items.map(([key,label])=>`<button class="${active===key?'active':''}" data-action="${action}" data-key="${key}">${label}</button>`).join('')}</div>`;}
function render(){
  if(!D){app.innerHTML='<div class="boot"><div class="brand-symbol">LQ</div><p>در حال بارگذاری محتوای آموزشی...</p></div>';return;}
  const pages={home:renderHome,learn:renderLearn,quizzes:renderQuizzes,progress:renderProgress,more:renderMore,profile:renderProfile,quiz:renderQuiz,results:renderResults,search:renderSearch};
  const content=(pages[state.view]||renderHome)();
  app.innerHTML=`<div class="app-frame">
    <aside class="sidebar"><a class="brand" href="./" data-action="view" data-view="home"><div class="brand-symbol">LQ</div><div><div class="brand-name">LEXIQUEST 9</div><div class="brand-sub">ENGLISH QUEST · LEVEL UP</div></div></a>
      <div class="side-label">MAIN MENU</div><nav class="side-nav">${navItem('home','⌂','خانه')}${navItem('learn','▤','یادگیری')}${navItem('quizzes','✦','میدان آزمون')}${navItem('progress','◷','پیشرفت من')}${navItem('more','···','امکانات بیشتر')}</nav>
      <div class="side-bottom"><div class="side-quest"><strong>⚡ مسیر قهرمانی</strong><p>هر روز چند دقیقه تمرین کن و مرحله‌به‌مرحله جلو برو.</p><div class="side-xp"><span>LEVEL ${level()}</span><span>${xp()} XP</span></div><div class="side-track"><span style="width:${Math.min(100,(xp()%120)/1.2)}%"></span></div></div><button class="side-link" data-action="view" data-view="profile" style="margin-top:9px">⚙️ تنظیمات و پشتیبان</button></div>
    </aside>
    <div class="main-area"><header class="topbar"><div class="top-left"><a class="mobile-brand" href="./" data-action="view" data-view="home"><span class="brand-symbol">LQ</span><span><strong>LEXIQUEST 9</strong><small>ENGLISH QUEST</small></span></a><form class="top-search" id="global-search-form"><input id="global-search" value="${esc(state.searchQuery)}" placeholder="جست‌وجوی واژه، معنی، گرامر..." aria-label="جست‌وجو"></form></div><div class="top-actions"><button class="icon-btn" data-action="theme" title="تغییر حالت روشن و تاریک">${state.theme==='dark'?'☀':'◐'}</button><button class="user-chip" data-action="view" data-view="profile"><span class="avatar">${esc((state.displayName||'L').slice(0,1))}</span><span><strong>${esc(state.displayName||'قهرمان')}</strong><small>LEVEL ${level()} · ${xp()} XP</small></span></button></div></header><main>${content}</main><footer class="static-footnote">LexiQuest 9 · نسخهٔ استاتیک مستقل · داده‌های منبع در فایل static-data.json نگهداری می‌شوند. © محتوای آموزشی مطابق فایل‌های منبع پروژه.</footer></div>
  </div><nav class="bottom-nav">${mobileNav('home','⌂','خانه')}${mobileNav('learn','▤','یادگیری')}${mobileNav('quizzes','✦','آزمون‌ها')}${mobileNav('progress','◷','پیشرفت')}${mobileNav('more','···','بیشتر')}</nav>`;
}
function level(){return Math.floor(xp()/120)+1;}
function xp(){return state.attempts.reduce((n,a)=>n+(a.xp||0),0)+Object.values(state.wordProgress).reduce((n,p)=>n+(p.reps||0)*2,0);}
function activeStreak(){
  const days=new Set(state.activeDays||[]);let count=0;const d=new Date();
  if(!days.has(dayKey(d)))d.setDate(d.getDate()-1);
  while(days.has(dayKey(d))){count++;d.setDate(d.getDate()-1);}return count;
}
function touchToday(){const key=dayKey();if(!state.activeDays.includes(key))state.activeDays.push(key);state.activeDays=state.activeDays.slice(-60);}
function renderHome(){
  const mastered=Object.values(state.wordProgress).filter(p=>p.status==='mastered').length;
  const weak=Object.values(state.wordProgress).filter(p=>p.status==='weak').length;
  const due=Object.values(state.wordProgress).filter(p=>p.due_at&&new Date(p.due_at)<=new Date()).length;
  const grammarMastered=Object.values(state.grammarProgress).filter(p=>p.status==='mastered').length;
  const word=D.vocabulary[(new Date().getDate()*13)%D.vocabulary.length];
  const lessonCards=D.lessonGuides.map(l=>`<article class="static-card static-lesson"><div class="lesson-theme">${esc(l.theme)}</div><h3>درس ${faNum(l.lesson_id)} · ${esc(l.title_fa)}</h3><p>${esc(l.mission)}</p><div class="static-card-actions"><button class="btn btn-primary btn-sm" data-action="open-lesson" data-lesson="${l.lesson_id}">شروع درس ↗</button><button class="btn btn-outline btn-sm" data-action="open-lesson-grammar" data-lesson="${l.lesson_id}">گرامر درس</button></div></article>`).join('');
  return `${heading('YOUR LEARNING DASHBOARD',`سلام ${esc(state.displayName||'قهرمان')}! 👋`,'هر تمرین کوچک تو را یک قدم جلوتر می‌برد.')}${notice()}
    <section class="hero"><div class="hero-copy"><span class="hero-chip">✦ DAILY QUEST · مأموریت امروز</span><h2>آماده‌ای یک مرحلهٔ تازه باز کنی؟</h2><p>از میان شش درس Prospect 3 انتخاب کن، واژه‌ها را مرور کن و با آزمون‌های چندسطحی میزان یادگیری‌ات را بسنج.</p><div class="hero-actions"><button class="btn btn-primary" data-action="view" data-view="quizzes">شروع آزمون هوشمند ↗</button><button class="btn" style="background:#ffffff18;color:#fff;border:1px solid #ffffff28" data-action="view" data-view="learn">رفتن به بخش یادگیری</button></div></div><div class="hero-art"><div class="orbit"><div class="orbit-core">LQ<br><span style="font-size:13px">09</span></div><span class="orbit-tag">${faNum(activeStreak())} روز پیوسته 🔥</span></div></div></section>
    <section class="static-stat-row"><div class="static-stat"><b>${faNum(D.vocabulary.length)}</b><span>واژه و عبارت یکتا</span></div><div class="static-stat"><b>${faNum(mastered)}</b><span>واژهٔ مسلط‌شده</span></div><div class="static-stat"><b>${faNum(weak)}</b><span>واژهٔ نیازمند تمرین</span></div><div class="static-stat"><b>${faNum(state.attempts.length)}</b><span>آزمون انجام‌شده</span></div></section>
    <section class="grid home-grid"><article class="panel"><div class="panel-head"><div><h3>وضعیت یادگیری</h3><p>اطلاعات ثبت‌شده در همین مرورگر</p></div><span class="pill green">${faNum(xp())} XP</span></div><div class="daily-top"><strong>واژه‌های نیازمند مرور</strong><b>${faNum(due)}</b></div><div class="progress-bar"><span style="width:${Math.min(100,due/Math.max(1,D.vocabulary.length)*100)}%"></span></div><div class="daily-top"><strong>مبحث‌های گرامر مسلط</strong><b>${faNum(grammarMastered)} / ${faNum(D.grammar.length)}</b></div><div class="progress-bar"><span style="width:${grammarMastered/D.grammar.length*100}%"></span></div><div class="daily-note">🌱 مرور کوتاه و پیوسته از مطالعهٔ فشرده و نامنظم مؤثرتر است.</div><div class="section-row"><div><h2>فعالیت‌های اخیر</h2><p>آخرین آزمون‌های ثبت‌شده</p></div><button class="link-btn" data-action="view" data-view="progress">مشاهدهٔ همه ←</button></div>${state.attempts.slice(0,4).map(a=>`<div class="admin-row"><span>${esc(MODES[a.mode]||a.mode)} · ${faNum(a.correct)}/${faNum(a.total)}</span><b>${faNum(a.accuracy)}٪</b></div>`).join('')||'<div class="empty">هنوز آزمونی انجام نداده‌ای.</div>'}</article>
      <article class="panel"><div class="panel-head"><div><h3>📚 واژهٔ امروز</h3><p>برای مرور و یادگیری عمیق‌تر</p></div><span class="pill">درس ${faNum(word.lesson_id)}</span></div><div class="word-title" style="font-size:27px">${esc(word.word)}</div><div class="ipa">${esc(word.ipa||'')}</div><div class="word-meaning">${esc(word.meaning)}</div><div class="static-example"><b>${esc(word.example_en)}</b><small>${esc(word.example_fa)}</small></div><button class="btn btn-soft btn-sm" data-action="speak" data-text="${esc(word.word)}">🔊 شنیدن تلفظ</button><div class="section-row"><div><h2>هدف روزانه</h2><p>مرور و آزمون‌های تو امتیاز تجربه می‌سازند.</p></div><b>${faNum(Math.min(100,Math.round(xp()/Math.max(1,state.dailyGoal*5)*100)))}٪</b></div><div class="progress-bar"><span style="width:${Math.min(100,xp()/Math.max(1,state.dailyGoal*5)*100)}%"></span></div></article></section>
    <div class="section-row"><div><h2>نقشهٔ شش‌مرحله‌ای Prospect 3</h2><p>هر درس را باز کن تا مأموریت‌ها و نکته‌های گرامری را ببینی.</p></div><button class="link-btn" data-action="view" data-view="learn">همهٔ امکانات ←</button></div><div class="static-grid">${lessonCards}</div><div class="static-source">منبع محتوای این نسخه، فایل‌های آموزشی همراه پروژه است. واژه‌ها، فونتیک‌ها، ترجمه‌ها و جمله‌های نمونه از داده‌های موجود در همان فایل‌ها استخراج شده‌اند؛ این صفحه ادعای بررسی مجدد تمام مطالب در برابر نسخهٔ چاپی کتاب ندارد.</div>`;
}
const LEARN_TABS=[['map','نقشهٔ درس‌ها'],['vocabulary','واژگان'],['grammar','گرامر'],['phrases','مکالمه'],['reviews','مرورهای کتاب'],['irregular','افعال بی‌قاعده'],['reading','درک مطلب'],['speaking','گفتاری'],['listening','شنیداری']];
function renderLearn(){
  const body={map:renderLessonMap,vocabulary:renderVocabulary,grammar:renderGrammar,phrases:renderPhrases,reviews:renderReviews,irregular:renderIrregular,reading:renderReadings,speaking:renderSpeaking,listening:renderListening}[state.learnTab]||renderLessonMap;
  return `${heading('LEARNING STUDIO','آزمایشگاه یادگیری','نقشهٔ درس، بانک واژگان، گرامر، مکالمه و تمرین‌های تکمیلی.')}${subnav(LEARN_TABS,state.learnTab,'learn-tab')}${body()}`;
}
function renderLessonMap(){
  if(state.selectedLesson){
    const l=D.lessonGuides.find(x=>x.lesson_id===Number(state.selectedLesson));
    if(l){
      const phrases=D.phraseBank.filter(p=>p.lesson_id===l.lesson_id);
      return `<button class="btn btn-outline btn-sm" data-action="back-lessons">← بازگشت به نقشهٔ درس‌ها</button><section class="panel" style="margin-top:12px"><span class="eyebrow">LESSON ${l.lesson_id} · ${esc(l.theme)}</span><h2>${esc(l.title_fa)}</h2><p>${esc(l.mission)}</p><div class="section-row"><h2>در پایان این درس می‌توانی:</h2></div>${l.can_do.map(x=>`<div class="admin-row"><span>✓ ${esc(x)}</span></div>`).join('')}<div class="hero-actions" style="margin-top:13px"><button class="btn btn-primary btn-sm" data-action="open-lesson-grammar" data-lesson="${l.lesson_id}">مطالعهٔ گرامر درس</button><button class="btn btn-outline btn-sm" data-action="open-lesson-vocabulary" data-lesson="${l.lesson_id}">واژگان همین درس</button><button class="btn btn-outline btn-sm" data-action="start-quiz" data-mode="lesson" data-lesson="${l.lesson_id}">آزمون درس</button></div></section><div class="section-row"><h2>نکته‌های گرامری و ساختارها</h2></div>${l.grammar_units.map(u=>`<section class="static-grammar-unit"><span class="static-tag">${esc(u.kind)}</span><h3>${esc(u.title)}</h3><p>${esc(u.rule)}</p><div class="static-formula">${esc(u.form)}</div><div class="static-examples">${(u.examples||[]).map(e=>`<div class="static-example"><b>${esc(e[0])}</b><small>${esc(e[1])}</small><button class="link-btn" data-action="speak" data-text="${esc(e[0])}">🔊</button></div>`).join('')}</div></section>`).join('')}<div class="section-row"><h2>الگوهای مکالمه</h2></div><div class="static-grid">${phrases.map(p=>`<article class="static-card"><h3>${esc(p.name)}</h3><div class="static-example"><b>${esc(p.pattern)}</b><small>${esc(p.fa)}</small></div><p class="ltrline">${esc(p.reply)}</p><button class="btn btn-soft btn-sm" data-action="speak" data-text="${esc(p.pattern+' '+p.reply)}">🔊 شنیدن</button></article>`).join('')}</div><div class="section-row"><h2>تمرین مهارت‌ها</h2></div><div class="static-grid">${Object.entries(l.missions||{}).map(([k,v])=>`<article class="static-card"><span class="pill">${esc(k)}</span><p>${esc(v)}</p></article>`).join('')}</div><section class="panel" style="margin-top:14px"><h3>چک‌پوینت پایانی</h3>${l.checkpoint.map(x=>`<div class="admin-row"><span>□ ${esc(x)}</span></div>`).join('')}</section>`;
    }
  }
  return `<div class="static-grid">${D.lessonGuides.map(l=>`<article class="static-card static-lesson"><div class="lesson-theme">LESSON ${l.lesson_id} · ${esc(l.theme)}</div><h3>${esc(l.title_fa)}</h3><p>${esc(l.mission)}</p><div>${l.can_do.map(x=>`<span class="static-tag">${esc(x)}</span>`).join('')}</div><div class="static-card-actions"><button class="btn btn-primary btn-sm" data-action="open-lesson" data-lesson="${l.lesson_id}">مشاهدهٔ مأموریت ↗</button><button class="btn btn-outline btn-sm" data-action="open-lesson-grammar" data-lesson="${l.lesson_id}">گرامر</button><button class="btn btn-outline btn-sm" data-action="start-quiz" data-mode="lesson" data-lesson="${l.lesson_id}">آزمون درس</button></div></article>`).join('')}</div><div class="static-source">هر راهنمای درس شامل هدف یادگیری، توانایی‌های مورد انتظار، ریزنکته‌های گرامری، الگوهای گفت‌وگو، تمرین مهارت‌ها و چک‌پوینت پایانی است.</div>`;
}
function renderVocabulary(){
  const f=state.filters;
  let words=D.vocabulary.map((w,i)=>({...w,_index:i,_status:statusForWord(w)}));
  if(f.q){const q=f.q.toLocaleLowerCase();words=words.filter(w=>[w.word,w.meaning,w.ipa,w.example_en,w.example_fa].join(' ').toLocaleLowerCase().includes(q));}
  if(f.lesson)words=words.filter(w=>w.lesson_id===Number(f.lesson));
  if(f.status)words=words.filter(w=>w._status===f.status);
  if(f.pos)words=words.filter(w=>w.part_of_speech===f.pos);
  if(f.favorite)words=words.filter(w=>state.favorites.includes(w._index));
  const pageSize=24,pages=Math.max(1,Math.ceil(words.length/pageSize));state.vocabPage=Math.min(state.vocabPage,pages-1);
  const visible=words.slice(state.vocabPage*pageSize,(state.vocabPage+1)*pageSize);
  const cards=visible.map(w=>wordCard(w)).join('')||'<div class="static-empty">واژه‌ای با این فیلترها پیدا نشد.</div>';
  return `<form id="vocab-filter-form" class="static-controls"><input class="field" name="q" value="${esc(f.q)}" placeholder="واژه، معنی یا مثال..."><select class="select" name="lesson"><option value="">همهٔ درس‌ها</option>${D.lessons.map(l=>`<option value="${l.id}" ${String(f.lesson)===String(l.id)?'selected':''}>درس ${l.id} · ${esc(l.title)}</option>`).join('')}</select><select class="select" name="status"><option value="">همهٔ وضعیت‌ها</option>${Object.entries(STATUS).map(([k,v])=>`<option value="${k}" ${f.status===k?'selected':''}>${v}</option>`).join('')}</select><select class="select" name="pos"><option value="">همهٔ نقش‌های دستوری</option>${[...new Set(D.vocabulary.map(w=>w.part_of_speech))].filter(Boolean).sort().map(p=>`<option value="${esc(p)}" ${f.pos===p?'selected':''}>${esc(p)}</option>`).join('')}</select><label class="small"><input type="checkbox" name="favorite" ${f.favorite?'checked':''}> فقط علاقه‌مندی‌ها</label><button class="btn btn-primary btn-sm" type="submit">اعمال فیلتر</button><button class="btn btn-outline btn-sm" type="button" data-action="clear-vocab-filter">پاک‌کردن</button></form>
  <div class="section-row"><div><h2>${faNum(words.length)} واژه و عبارت</h2><p>تلفظ نوشتاری، معنی، مثال، مترادف و متضاد در صورت وجود.</p></div><button class="btn btn-soft btn-sm" data-action="start-quiz" data-mode="vocabulary">آزمون واژگان</button></div><div class="grid vocab-grid">${cards}</div><div class="static-pager"><button class="btn btn-outline btn-sm" data-action="vocab-page" data-dir="prev" ${state.vocabPage===0?'disabled':''}>قبلی</button><span class="small muted">صفحهٔ ${faNum(state.vocabPage+1)} از ${faNum(pages)}</span><button class="btn btn-outline btn-sm" data-action="vocab-page" data-dir="next" ${state.vocabPage>=pages-1?'disabled':''}>بعدی</button></div>`;
}
function wordCard(w){
  const p=getWordProgress(w),hidden=state.hiddenMeanings.includes(w._index),favorite=state.favorites.includes(w._index);
  const status=STATUS[statusForWord(w)]||STATUS.new;
  const note=[w.note?`نکته: ${w.note}`:'',w.synonyms?.length?`مترادف: ${w.synonyms.join(' · ')}`:'',w.antonyms?.length?`متضاد: ${w.antonyms.join(' · ')}`:''].filter(Boolean).map(x=>`<div class="word-note">${esc(x)}</div>`).join('');
  return `<article class="word-card static-word-card"><div class="word-top"><div><div class="word-title">${esc(w.word)}</div><div class="ipa">${esc(w.ipa||'')}</div></div><button class="icon-btn" data-action="favorite" data-index="${w._index}" title="علاقه‌مندی">${favorite?'♥':'♡'}</button></div><div class="word-meaning ${hidden?'blur-meaning':''}">${esc(w.meaning)}</div><div class="word-tags"><span class="pill">${esc(status)}</span><span class="pill">${esc(w.part_of_speech||'')}</span><span class="pill">درس ${w.lesson_id}</span><span class="pill">${w.category==='photo_dictionary'?'واژه‌نامهٔ تصویری':w.category==='lesson_text'?'متن/تمرین درس':'مکمل آموزشی'}</span></div><div class="word-example"><div class="en">${esc(w.example_en||'')}</div><div class="fa">${esc(w.example_fa||'')}</div></div>${note}<div class="word-actions"><button data-action="hide-meaning" data-index="${w._index}">${hidden?'نمایش معنی':'پنهان‌کردن معنی'}</button><button data-action="speak" data-text="${esc(w.word)}">🔊 تلفظ</button><button data-action="review-word" data-index="${w._index}" data-rating="known">بلدم ✓</button><button data-action="review-word" data-index="${w._index}" data-rating="hard">سخت بود ↻</button></div>${p.due_at?`<div class="tiny muted">مرور بعدی: ${esc(new Intl.DateTimeFormat('fa-IR',{dateStyle:'medium'}).format(new Date(p.due_at)))}</div>`:''}</article>`;
}
function renderGrammar(){
  const lesson=state.filters.lesson?Number(state.filters.lesson):0;
  const topics=D.grammar.filter(g=>!lesson||g.lesson_id===lesson);
  return `<div class="static-controls"><label class="small">انتخاب درس</label><select id="grammar-lesson" class="select"><option value="">همهٔ درس‌ها</option>${D.lessons.map(l=>`<option value="${l.id}" ${lesson===l.id?'selected':''}>درس ${l.id} · ${esc(l.title)}</option>`).join('')}</select><span class="small muted">${faNum(topics.length)} مبحث</span></div><div class="grammar-list">${topics.map(g=>grammarCard(g)).join('')}</div>`;
}
function grammarCard(g){
  const guide=D.lessonGuides.find(x=>x.lesson_id===g.lesson_id);const progress=state.grammarProgress[g.lesson_id]||{status:'new',correct:0,wrong:0};
  const units=(guide?.grammar_units||[]).map(u=>`<section class="static-grammar-unit"><span class="static-tag">${esc(u.kind)}</span><h4>${esc(u.title)}</h4><p>${esc(u.rule)}</p><div class="static-formula">${esc(u.form)}</div><div class="static-examples">${(u.examples||[]).map(e=>`<div class="static-example"><b>${esc(e[0])}</b><small>${esc(e[1])}</small><button class="link-btn" data-action="speak" data-text="${esc(e[0])}">🔊 شنیدن</button></div>`).join('')}</div></section>`).join('');
  return `<article class="grammar-card"><div class="panel-head"><div><span class="eyebrow">LESSON ${g.lesson_id} · ${esc(g.title)}</span><h3>${esc(D.lessons[g.lesson_id-1]?.title||'')}</h3><p>${esc(g.summary)}</p></div><span class="pill ${progress.status==='mastered'?'green':progress.status==='weak'?'red':'orange'}">${STATUS[progress.status]||'یادنگرفته'}</span></div><div class="static-formula">${esc(g.formula)}</div><div class="small"><b>کاربرد:</b> ${esc(g.usage)}</div><div class="examples">${(g.examples||[]).map(e=>`<div class="example"><div class="en">${esc(e.en)}</div><div class="fa">${esc(e.fa)}</div><button class="link-btn" data-action="speak" data-text="${esc(e.en)}">🔊</button></div>`).join('')}</div><div class="grammar-guide-stack"><div class="grammar-guide-heading"><span class="eyebrow">FULL GRAMMAR MAP</span><b>ریز‌نکته‌های ثبت‌شده برای این درس</b></div>${units}</div><div class="grammar-notes"><div class="note-box"><strong>See also</strong>${esc(g.see_also)}</div><div class="note-box"><strong>اشتباه رایج</strong>${esc(g.common_errors)}</div></div><div class="word-actions"><button data-action="grammar-status" data-lesson="${g.lesson_id}" data-status="mastered">✓ یاد گرفتم</button><button data-action="grammar-status" data-lesson="${g.lesson_id}" data-status="learning">نیاز به تمرین</button><button class="btn btn-primary btn-sm" data-action="start-quiz" data-mode="grammar" data-lesson="${g.lesson_id}">خودت را محک بزن ↗</button></div></article>`;
}
function renderPhrases(){return `<div class="static-grid">${D.phraseBank.map(p=>`<article class="static-card"><span class="pill">درس ${p.lesson_id} · ${esc(p.theme)}</span><h3>${esc(p.name)}</h3><div class="static-example"><b>${esc(p.pattern)}</b><small>${esc(p.fa)}</small></div><p class="ltrline">${esc(p.reply)}</p><button class="btn btn-soft btn-sm" data-action="speak" data-text="${esc(p.pattern+' '+p.reply)}">🔊 شنیدن گفت‌وگو</button></article>`).join('')}</div>`;}
function renderReviews(){return `<div class="static-grid">${D.reviewUnits.map(r=>`<article class="static-card"><span class="pill">مرور ${r.id}</span><h3>${esc(r.title)}</h3><p>${esc(r.goal)}</p><div class="static-grammar-unit"><b>واژگان</b><p>${r.vocabulary.map(esc).join(' · ')}</p><b>گرامر</b><p>${r.grammar.map(esc).join(' · ')}</p><b>آهنگ گفتار</b><p>${esc(r.melody)}</p></div><h4>مأموریت‌ها</h4>${r.missions.map(m=>`<div class="static-example"><b>${esc(m.type)}</b><small>${esc(m.prompt)}</small></div>`).join('')}</article>`).join('')}</div>`;}
function renderIrregular(){
  const q=(state.irregularQuery||'').toLocaleLowerCase();const list=D.irregularVerbs.filter(v=>!q||[v.base,v.past,v.meaning].join(' ').toLocaleLowerCase().includes(q));
  return `<div class="static-controls"><input class="field" id="irregular-search" value="${esc(state.irregularQuery||'')}" placeholder="جست‌وجوی شکل پایه، گذشته یا معنی"><span class="small muted">${faNum(list.length)} فعل</span><button class="btn btn-primary btn-sm" data-action="start-quiz" data-mode="irregular">آزمون افعال ↗</button></div><div class="static-table-wrap"><table class="static-table"><thead><tr><th>شکل پایه</th><th>گذشته</th><th>معنی</th><th>نمونه</th><th>تلفظ</th></tr></thead><tbody>${list.map(v=>`<tr><td class="ltr">${esc(v.base)}</td><td class="ltr">${esc(v.past)}</td><td>${esc(v.meaning)}</td><td><span class="ltr">${esc(v.example_en)}</span><br><small>${esc(v.example_fa)}</small></td><td><button class="link-btn" data-action="speak" data-text="${esc(v.base+' '+v.past)}">🔊</button></td></tr>`).join('')}</tbody></table></div><div class="static-source">نمونه‌های این جدول از فایل اصلاحات ۵۹ فعل بی‌قاعدهٔ پروژه جایگزین شده‌اند. برای فعل be، شکل گذشتهٔ was/were به‌صورت دوگانه ارائه می‌شود.</div>`;
}
function renderReadings(){return `<div class="static-grid">${D.readingTexts.map(r=>`<article class="reading-card"><div class="panel-head"><div><span class="pill">درس ${r.lesson_id} · ${DIFFICULTY[r.level]||r.level}</span><h3>${esc(r.title)}</h3></div><button class="icon-btn" data-action="speak" data-text="${esc(r.text)}">🔊</button></div><div class="reading-text">${esc(r.text)}</div><details style="margin-top:9px"><summary class="link-btn">نمایش ترجمهٔ فارسی</summary><div class="reading-translation">${esc(r.translation)}</div></details><div class="static-card-actions"><button class="btn btn-primary btn-sm" data-action="reading-questions" data-id="${esc(r.id)}">پرسش‌های درک مطلب</button></div></article>`).join('')}</div>`;}
function renderSpeaking(){return `${heading('SPEAKING STUDIO','تمرین گفتاری','عبارت‌های کاربردی را با صدای بلند تکرار کن و تلفظ ماشینی متن دلخواهت را بشنو.')}<section class="panel"><form id="pronounce-form" class="static-controls"><input class="field" name="phrase" maxlength=300 placeholder="یک کلمه یا جملهٔ انگلیسی بنویس..."><button class="btn btn-primary">پخش تلفظ 🔊</button></form><p class="tiny muted">صدای پخش‌شده به موتور گفتار و زبان‌های نصب‌شده در دستگاه وابسته است.</p></section><div class="section-row"><h2>الگوهای گفت‌وگو برای تمرین</h2></div><div class="static-grid">${D.phraseBank.map(p=>`<article class="static-card"><h3>${esc(p.name)}</h3><div class="static-example"><b>${esc(p.pattern)}</b><small>${esc(p.fa)}</small></div><p class="ltrline">${esc(p.reply)}</p><button class="btn btn-soft btn-sm" data-action="speak" data-text="${esc(p.pattern+' '+p.reply)}">🔊 تمرین مکالمه</button></article>`).join('')}</div>`;}
function renderListening(){const index=Number(state.listeningIndex||0)%D.phraseBank.length;const phrase=D.phraseBank[index];return `${heading('LISTENING PRACTICE','تمرین شنیداری','جمله را با گفتار ماشینی پخش کن؛ ابتدا بدون نگاه‌کردن گوش بده و سپس متن را بررسی کن.')}<section class="panel"><span class="pill">درس ${phrase.lesson_id} · ${esc(phrase.theme)}</span><h2 style="margin-top:10px">${esc(phrase.name)}</h2><div class="static-example ${state.listeningHidden===false?'':'hidden'}"><b>${esc(phrase.pattern)}</b><small>${esc(phrase.fa)}</small><p class="ltrline">${esc(phrase.reply)}</p></div><div class="hero-actions" style="margin-top:15px"><button class="btn btn-primary" data-action="listen-play">▶ پخش جمله</button><button class="btn btn-outline" data-action="listen-toggle">${state.listeningHidden===false?'پنهان‌کردن متن':'نمایش متن و معنی'}</button><button class="btn btn-outline" data-action="listen-next">عبارت بعدی ↗</button></div><div class="static-source">این تمرین از گفتار ماشینی مرورگر استفاده می‌کند و فایل صوتی کتاب نیست. تلفظ، لهجه و کیفیت صدا ممکن است با دستگاه متفاوت باشد.</div></section>`;}
const QUIZ_TILES=[['smart','🧠','آزمون هوشمند','ترکیبی از محتوای مرتبط با درس‌ها'],['vocabulary','📚','واژگان','معنی و کاربرد واژه‌ها'],['translation','🌐','ترجمه','انتخاب معادل فارسی یا انگلیسی'],['grammar','✎','گرامر','تمرین نکته‌های دستوری'],['lesson','🎯','درس‌به‌درس','تمرین از یک درس مشخص'],['comprehensive','🏆','آزمون جامع','سؤال‌هایی از همهٔ درس‌ها'],['mistakes','↻','اشتباهات','تمرکز بر سؤال‌هایی که قبلاً غلط زده‌ای'],['exam','📝','شبیه امتحان','ترکیبی از سؤال‌های بانک آزمون'],['challenge','⚡','چالش دشوار','سؤال‌های سطح دشوار و چالشی'],['irregular','🔤','افعال بی‌قاعده','شکل گذشته و معنی افعال'],['reading','📖','درک مطلب','پرسش از متن‌های خواندنی']];
function renderQuizzes(){return `${heading('QUIZ ARENA','میدان آزمون','نوع آزمون، درس، تعداد سؤال و سطح دشواری را انتخاب کن.')}${notice()}<div class="quiz-grid">${QUIZ_TILES.map(([m,icon,title,desc])=>`<button class="quiz-tile" data-action="choose-quiz" data-mode="${m}"><span class="tile-icon">${icon}</span><h3>${title}</h3><p>${desc}</p><span class="link-btn">انتخاب آزمون ←</span></button>`).join('')}</div><section class="panel" style="margin-top:16px"><div class="panel-head"><div><h3>تنظیم آزمون دلخواه</h3><p>می‌توانی آزمون ترکیبی یا درس مشخص بسازی.</p></div></div><form id="quiz-setup" class="static-controls"><label class="small">نوع آزمون<select class="select" name="mode">${Object.entries(MODES).map(([k,v])=>`<option value="${k}" ${state.quizMode===k?'selected':''}>${v}</option>`).join('')}</select></label><label class="small">درس<select class="select" name="lesson"><option value="">همهٔ درس‌ها</option>${D.lessons.map(l=>`<option value="${l.id}" ${String(state.quizLesson)===String(l.id)?'selected':''}>درس ${l.id} · ${esc(l.title)}</option>`).join('')}</select></label><label class="small">سطح<select class="select" name="difficulty">${Object.entries(DIFFICULTY).map(([k,v])=>`<option value="${k}" ${state.quizDifficulty===k?'selected':''}>${v}</option>`).join('')}</select></label><label class="small">تعداد<select class="select" name="count">${[5,10,15,20,30].map(n=>`<option value="${n}" ${state.quizCount===n?'selected':''}>${faNum(n)} سؤال</option>`).join('')}</select></label><button class="btn btn-primary" type="submit">ساخت آزمون و شروع ↗</button></form><p class="tiny muted">اگر بانک سؤال برای فیلتر انتخاب‌شده کمتر از تعداد درخواستی باشد، آزمون با تعداد سؤال‌های موجود ساخته می‌شود.</p></section>`;}
function startQuiz(mode='smart',lesson='',count=state.quizCount,difficulty=state.quizDifficulty){
  let questions=[];const selectedLesson=Number(lesson)||0;
  const addRandomOptions=(correct,pool)=>{
    const choices=shuffle([...new Set(pool.filter(x=>x!==correct))]).slice(0,3);return shuffle([correct,...choices]);
  };
  const vocabularyForQuiz=D.vocabulary.filter(w=>!selectedLesson||w.lesson_id===selectedLesson);
  if(mode==='vocabulary'||mode==='translation'){
    const pool=shuffle(vocabularyForQuiz.length>=4?vocabularyForQuiz:D.vocabulary).slice(0,Math.min(count*3,D.vocabulary.length));
    questions=shuffle(pool).slice(0,count).map((w,i)=>{
      const isTranslate=mode==='translation';const correct=isTranslate?w.word:w.meaning;
      const distractors=pool.map(x=>isTranslate?x.word:x.meaning);
      const options=addRandomOptions(correct,distractors);
      return {id:`${mode}-${i}-${w.lesson_id}-${w.word}`,type:'vocabulary',wordKey:wordKey(w),prompt:isTranslate?`معادل انگلیسی «${w.meaning}» کدام است؟`:`معنی واژهٔ «${w.word}» کدام است؟`,options,correct_index:options.indexOf(correct),explanation:`${w.word} یعنی ${w.meaning}. مثال: ${w.example_en}`,word:w.word};
    });
  }else if(mode==='irregular'){
    const pool=shuffle(D.irregularVerbs.filter(v=>!selectedLesson||true));
    questions=pool.slice(0,count).map((v,i)=>{const correct=v.past;const options=addRandomOptions(correct,pool.map(x=>x.past));return{id:`verb-${i}-${v.base}`,type:'irregular',prompt:`گذشتهٔ فعل «${v.base}» کدام است؟`,options,correct_index:options.indexOf(correct),explanation:`${v.base} → ${v.past} · ${v.meaning}`,word:v.base};});
  }else if(mode==='reading'){
    let readings=D.readingTexts.filter(r=>!selectedLesson||r.lesson_id===selectedLesson);if(!readings.length)readings=D.readingTexts;
    const pool=shuffle(readings.flatMap(r=>r.questions.map((q,i)=>({id:`${r.id}-${i}`,lesson_id:r.lesson_id,title:r.title,text:r.text,...q}))));
    questions=pool.slice(0,count).map(q=>({id:q.id,type:'reading',prompt:q.prompt,context:q.text,options:q.options,correct_index:q.answer,explanation:q.explanation,readingTitle:q.title}));
  }else{
    let pool=[...D.questions];
    if(mode==='grammar')pool=pool.filter(q=>q.grammar_id);
    if(mode==='challenge')pool=pool.filter(q=>q.difficulty==='hard'||q.difficulty==='expert');
    if(mode==='lesson'||selectedLesson)pool=pool.filter(q=>q.lesson_id===selectedLesson);
    if(mode==='mistakes'){
      const wrong=new Set(state.wrongQuestionIds);const wrongPool=pool.filter(q=>wrong.has(q.id));if(wrongPool.length)pool=wrongPool;
    }
    if(mode==='smart'){
      const weakLessons=Object.entries(state.grammarProgress).filter(([,p])=>p.status!=='mastered').map(([id])=>Number(id));
      const priority=pool.filter(q=>state.wrongQuestionIds.includes(q.id)||(weakLessons.includes(q.lesson_id)));
      if(priority.length)pool=shuffle([...priority,...pool]);
    }
    if(difficulty==='easy'||difficulty==='medium'||difficulty==='hard'||difficulty==='expert'){
      const specific=pool.filter(q=>q.difficulty===difficulty);if(specific.length>=Math.min(count,3))pool=specific;
    }
    questions=shuffle(pool).slice(0,count).map(q=>({...q,type:'source'}));
  }
  if(!questions.length){toast('برای این انتخاب سؤال کافی وجود ندارد.','error');return;}
  state.quiz={mode,lesson:selectedLesson,questions,startedAt:Date.now()};state.quizAnswers={};state.questionIndex=0;state.result=null;state.view='quiz';saveState();render();window.scrollTo({top:0,behavior:'smooth'});
}
function renderQuiz(){
  const quiz=state.quiz;if(!quiz)return renderQuizzes();const q=quiz.questions[state.questionIndex];if(!q)return renderQuizzes();
  const selected=state.quizAnswers?.[q.id];const pct=Math.round((state.questionIndex+1)/quiz.questions.length*100);
  return `${heading('FOCUS MODE','زمان تمرکز','برای هر سؤال گزینهٔ مناسب را انتخاب کن؛ در پایان پاسخ‌ها بررسی می‌شوند.')}
    <div class="static-quiz-shell"><div class="panel"><div class="daily-top"><b>${esc(MODES[quiz.mode]||'آزمون')}</b><span class="small muted">سؤال ${faNum(state.questionIndex+1)} از ${faNum(quiz.questions.length)}</span></div><div class="static-progress"><span style="width:${pct}%"></span></div></div><section class="static-question"><span class="pill">${q.type==='vocabulary'?'واژگان':q.type==='irregular'?'افعال بی‌قاعده':q.type==='reading'?'درک مطلب':`درس ${q.lesson_id||'ترکیبی'}`}</span>${q.context?`<div class="reading-text" style="margin-top:12px">${esc(q.context)}</div>`:''}<h2>${esc(q.prompt)}</h2><div class="static-options">${q.options.map((o,i)=>`<button class="static-option ${selected===i?'selected':''}" data-action="answer" data-index="${i}"><span class="key">${String.fromCharCode(65+i)}</span><span class="${/[A-Za-z]/.test(o)?'ltr':''}">${esc(o)}</span></button>`).join('')}</div><div class="static-quiz-footer"><button class="btn btn-outline" data-action="quiz-cancel">خروج از آزمون</button><div><button class="btn btn-outline" data-action="quiz-prev" ${state.questionIndex===0?'disabled':''}>قبلی</button> <button class="btn btn-primary" data-action="quiz-next" ${selected===undefined?'disabled':''}>${state.questionIndex===quiz.questions.length-1?'ثبت پاسخ‌ها':'سؤال بعدی'} ↗</button></div></div></section></div>`;
}
function finishQuiz(){
  if(!state.quiz)return;const quiz=state.quiz,answers=state.quizAnswers||{};const details=quiz.questions.map(q=>{const chosen=answers[q.id];const isCorrect=chosen===q.correct_index;return {...q,chosen:chosen===undefined?'بدون پاسخ':q.options[chosen],correctAnswer:q.options[q.correct_index],isCorrect};});
  const correct=details.filter(x=>x.isCorrect).length,total=details.length,accuracy=Math.round(correct/Math.max(1,total)*100),xpEarned=correct*5+(accuracy===100?10:0);
  for(const q of quiz.questions){
    const ok=answers[q.id]===q.correct_index;
    if(q.type==='vocabulary'&&q.wordKey){state.wordProgress[q.wordKey]=nextVocabularyState(state.wordProgress[q.wordKey],ok);}
    if(!ok&&q.type==='source'&&D.questions.some(source=>source.id===q.id)&&!state.wrongQuestionIds.includes(q.id))state.wrongQuestionIds.push(q.id);
    if(ok&&q.type==='source')state.wrongQuestionIds=state.wrongQuestionIds.filter(id=>id!==q.id);
    if(q.type==='source'&&q.lesson_id){const p=state.grammarProgress[q.lesson_id]||{correct:0,wrong:0,status:'learning'};p[ok?'correct':'wrong']++;if(p.correct>=5&&p.correct/(p.correct+p.wrong)>=.8)p.status='mastered';else if(p.wrong>p.correct)p.status='weak';else p.status='learning';state.grammarProgress[q.lesson_id]=p;}
  }
  touchToday();state.attempts.unshift({date:new Date().toISOString(),mode:quiz.mode,correct,total,accuracy,xp:xpEarned});state.attempts=state.attempts.slice(0,100);
  state.result={details,correct,total,accuracy,xp:xpEarned,duration:Math.round((Date.now()-quiz.startedAt)/1000),mode:quiz.mode};state.quiz=null;state.view='results';saveState();render();window.scrollTo({top:0,behavior:'smooth'});
}
function renderResults(){
  const r=state.result;if(!r)return renderQuizzes();
  return `${heading('QUIZ REPORT','گزارش آزمون','هر پاسخ، یک نکته برای بهتر شدن مرحلهٔ بعدی است.')}<section class="result-hero"><div class="result-score">${faNum(r.accuracy)}٪</div><h2>${r.accuracy>=80?'آفرین! عملکرد بسیار خوبی داشتی.':r.accuracy>=50?'پیشرفت خوبی در حال شکل‌گیری است.':'این نتیجه نقطهٔ شروع تمرین بعدی توست.'}</h2><p>${faNum(r.correct)} پاسخ درست از ${faNum(r.total)} سؤال · ${faNum(r.xp)} XP</p></section><section class="grid stats"><div>${statCard('پاسخ درست',r.correct,'✓','#d8f7ec')}</div><div>${statCard('نیازمند مرور',r.total-r.correct,'↻','#ffe7ea')}</div><div>${statCard('زمان آزمون',formatTime(r.duration),'◷','#e9e5ff')}</div><div>${statCard('امتیاز تجربه',r.xp,'✦','#fff0dc')}</div></section><div class="section-row"><div><h2>تحلیل پاسخ‌ها</h2><p>پاسخ تو، پاسخ صحیح و توضیح هر سؤال</p></div></div><div class="answer-review">${r.details.map((q,i)=>`<div class="answer-item ${q.isCorrect?'correct':'wrong'}"><strong>${faNum(i+1)}. ${esc(q.prompt)}</strong>${q.context?`<p>${esc(q.context)}</p>`:''}<p>پاسخ تو: <b>${esc(q.chosen)}</b></p>${!q.isCorrect?`<p>پاسخ صحیح: <b class="right-answer">${esc(q.correctAnswer)}</b></p>`:''}<p>${esc(q.explanation||'')}</p></div>`).join('')}</div><div class="hero-actions" style="margin-top:17px"><button class="btn btn-primary" data-action="retry-mistakes">تمرین دوبارهٔ اشتباه‌ها ↻</button><button class="btn btn-outline" data-action="view" data-view="progress">مشاهدهٔ پیشرفت</button><button class="btn btn-outline" data-action="view" data-view="home">بازگشت به خانه</button></div>`;
}
function statCard(label,value,icon,tint){return `<div class="stat-card" style="--tint:${tint}"><div class="stat-head"><span class="stat-label">${label}</span><span class="stat-icon">${icon}</span></div><div class="stat-value">${esc(value)}</div></div>`;}
function formatTime(seconds){return `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;}
function unlockedAchievements(){
  const mastered=D.vocabulary.filter(w=>statusForWord(w)==='mastered').length;
  const rules=[
    ['first_quiz',state.attempts.length>=1],['master_10',mastered>=10],['quiz_10',state.attempts.length>=10],
    ['accuracy_90',state.attempts.some(a=>a.accuracy>=90)],['challenge_win',state.attempts.some(a=>a.mode==='challenge'&&a.accuracy>=80)],
    ['grammar_master',Object.values(state.grammarProgress).some(p=>p.status==='mastered')]
  ];
  const unlocked=new Set(rules.filter(x=>x[1]).map(x=>x[0]));
  return D.achievements.map(a=>({...a,unlocked:unlocked.has(a.id)}));
}
function renderProgress(){
  const vals=Object.values(state.wordProgress),weak= D.vocabulary.filter(w=>statusForWord(w)==='weak'),mastered=vals.filter(p=>p.status==='mastered').length;
  const lessonRows=D.lessons.map(l=>{const words=D.vocabulary.filter(w=>w.lesson_id===l.id),count=words.filter(w=>statusForWord(w)==='mastered').length,percent=Math.round(count/Math.max(1,words.length)*100);return `<div class="lesson-mastery-row"><div><strong>درس ${l.id} · ${esc(l.title)}</strong><small>${faNum(count)} از ${faNum(words.length)} واژه مسلط</small></div><b>${faNum(percent)}٪</b><div class="progress-bar"><span style="width:${percent}%"></span></div></div>`;}).join('');
  return `${heading('MY PROGRESS','پیشرفت من','آمار یادگیری، واژه‌های نیازمند تمرین و تاریخچهٔ آزمون‌ها.')}${notice()}<section class="grid stats"><div>${statCard('روزهای پیاپی',activeStreak(),'🔥','#fff1dc')}</div><div>${statCard('واژه‌های مسلط',mastered,'✓','#d8f7ec')}</div><div>${statCard('واژه‌های ضعیف',weak.length,'↻','#ffe7ea')}</div><div>${statCard('آزمون‌ها',state.attempts.length,'✦','#e9e5ff')}</div></section><section class="panel"><div class="panel-head"><div><h3>تسلط واژگان در هر درس</h3><p>بر پایهٔ مرورهایی که انجام داده‌ای</p></div></div>${lessonRows}</section><section class="grid home-grid" style="margin-top:15px"><article class="panel"><div class="panel-head"><div><h3>واژه‌های نیازمند توجه</h3><p>با مرور درست، وضعیتشان تغییر می‌کند.</p></div><button class="btn btn-soft btn-sm" data-action="start-quiz" data-mode="vocabulary">آزمون واژگان</button></div>${weak.slice(0,12).map(w=>`<div class="admin-row"><span><b class="ltr">${esc(w.word)}</b> · ${esc(w.meaning)}</span><span class="pill red">${faNum(getWordProgress(w).incorrect_count||0)} خطا</span></div>`).join('')||'<div class="empty">فعلاً واژهٔ ضعیفی ثبت نشده است.</div>'}</article><article class="panel"><div class="panel-head"><div><h3>تاریخچهٔ آزمون‌ها</h3><p>آزمون‌ها فقط در این مرورگر نگهداری می‌شوند.</p></div></div>${state.attempts.slice(0,15).map(a=>`<div class="admin-row"><span>${esc(MODES[a.mode]||a.mode)}<small class="muted"> · ${esc(new Intl.DateTimeFormat('fa-IR',{dateStyle:'medium'}).format(new Date(a.date)))}</small></span><b>${faNum(a.correct)}/${faNum(a.total)} · ${faNum(a.accuracy)}٪</b></div>`).join('')||'<div class="empty">هنوز آزمونی انجام نشده است.</div>'}</article></section><div class="section-row"><h2>وضعیت گرامر</h2></div><div class="static-grid">${D.grammar.map(g=>{const p=state.grammarProgress[g.lesson_id]||{};return `<div class="static-card"><span class="pill">درس ${g.lesson_id}</span><h3>${esc(g.title)}</h3><p>${STATUS[p.status]||'یادنگرفته'} · ${faNum(p.correct||0)} درست · ${faNum(p.wrong||0)} نادرست</p><button class="btn btn-outline btn-sm" data-action="open-lesson-grammar" data-lesson="${g.lesson_id}">مرور گرامر</button></div>`;}).join('')}</div><div class="section-row"><h2>دستاوردها</h2></div><div class="static-grid">${unlockedAchievements().map(a=>`<article class="static-card"><div class="panel-head"><b style="font-size:21px">${a.icon}</b><span class="pill ${a.unlocked?'green':''}">${a.unlocked?'دریافت‌شده':'قفل'}</span></div><h3>${esc(a.title)}</h3><p>${esc(a.description)}</p></article>`).join('')}</div>`;
}
function renderMore(){
  const tabs=[['planner','برنامه‌ریز'],['writing','کارگاه نوشتن'],['helper','کمک‌یار آفلاین'],['english','English Corner'],['tips','نکات یادگیری'],['backup','پشتیبان داده']];
  const bodies={planner:renderPlanner,writing:renderWriting,helper:renderHelper,english:renderEnglish,tips:renderTips,backup:renderBackup};
  return `${heading('MORE TO EXPLORE','امکانات بیشتر','ابزارهای شخصی‌سازی و تمرین تکمیلی.')}${subnav(tabs,state.moreTab,'more-tab')}${(bodies[state.moreTab]||renderPlanner)()}`;
}
function renderPlanner(){
  const tasks=[['vocab','مرور ۱۰ واژه','واژه‌های دشوار یا موعددار را مرور کن.',10],['grammar','مرور گرامر یک درس','یک مبحث گرامری را بخوان و مثال‌ها را تمرین کن.',10],['quiz','یک آزمون کوتاه','یک آزمون ۵ سؤالی انجام بده.',10],['reading','خواندن متن انگلیسی','یک متن را بخوان و پرسش‌هایش را پاسخ بده.',10]];
  return `${heading('SMART PLANNER','برنامه‌ریز مطالعه','یک برنامهٔ سبک و قابل انجام برای تمرین روزانه.') }<section class="panel"><div class="panel-head"><div><h3>تنظیم هدف</h3><p>تعداد دقیقهٔ مطالعهٔ روزانه را مشخص کن.</p></div><span class="pill green">هدف فعلی: ${faNum(state.dailyGoal)} دقیقه</span></div><form id="goal-form" class="static-controls"><label class="small">هدف روزانه<select name="goal" class="select">${[5,10,15,20,30,45,60].map(n=>`<option value="${n}" ${state.dailyGoal===n?'selected':''}>${faNum(n)} دقیقه</option>`).join('')}</select></label><button class="btn btn-primary btn-sm">ذخیرهٔ هدف</button></form></section><div class="section-row"><div><h2>مأموریت‌های پیشنهادی</h2><p>هر فعالیت را پس از انجام علامت بزن.</p></div></div><div class="static-grid">${tasks.map(([id,title,desc,xp])=>{const key=`${dayKey()}-${id}`;const done=state.completedTasks.includes(key);return `<article class="static-card"><span class="pill">${done?'انجام‌شده':'پیشنهادی'}</span><h3>${title}</h3><p>${desc}</p><div class="static-card-actions">${done?'<span class="pill green">✓ تکمیل شد</span>':`<button class="btn btn-primary btn-sm" data-action="planner-launch" data-task="${id}">شروع</button><button class="btn btn-outline btn-sm" data-action="planner-complete" data-task="${id}">ثبت انجام ✓</button>`}</div></article>`;}).join('')}</div><div class="static-source">این برنامه‌ریز محلی است و فعالیت‌های تکمیل‌شده را فقط روی همین دستگاه نگه می‌دارد؛ زمان‌سنج یا همگام‌سازی آنلاین ندارد.</div>`;
}
function renderWriting(){return `${heading('WRITING WORKSHOP','کارگاه نوشتن','یک تمرین بنویس، پیش‌نویس را در همین مرورگر ذخیره کن و از چک‌لیست خودارزیابی استفاده کن.')}<section class="panel"><h3>تمرین: معرفی یک دوست</h3><p class="small muted">در ۳ تا ۵ جمله، شخصیت دوستت را توصیف کن. از واژه‌های درس اول و am / is / are استفاده کن.</p><form id="writing-form"><textarea class="textarea static-writing" name="writing" maxlength="5000" placeholder="My friend is kind and helpful...">${esc(state.writing)}</textarea><div class="hero-actions" style="margin-top:12px"><button class="btn btn-primary">ذخیرهٔ پیش‌نویس</button><button class="btn btn-outline" type="button" data-action="writing-check">نمایش چک‌لیست بررسی</button><button class="btn btn-outline" type="button" data-action="writing-example">دیدن نمونه</button></div></form><div id="writing-feedback">${state.writingHint?writingChecklist():''}</div><div class="static-source">این نسخه به مدل هوش مصنوعی یا سرویس تصحیح آنلاین متصل نیست. چک‌لیست فقط برای خودارزیابی است و متن را به سرویس خارجی ارسال نمی‌کند.</div></section>`;}
function writingChecklist(){return `<div class="static-grammar-unit"><h4>چک‌لیست خودارزیابی نوشته</h4><p>آیا جمله با حرف بزرگ شروع شده است؟ آیا پایان هر جمله نقطه دارد؟ آیا برای I از am، برای he/she/it از is و برای you/we/they از are استفاده کرده‌ای؟ آیا صفت‌ها را درست نوشته‌ای؟ آیا معنی جمله با قصد تو هماهنگ است؟</p><p>پس از بررسی، متن را با صدای بلند بخوان و جمله‌های نامفهوم را ساده‌تر کن.</p></div>`;}
function renderHelper(){const chat=state.chat.map(m=>`<div class="static-chat-message ${m.role==='user'?'me':'bot'}"><b>${m.role==='user'?'تو':'LexiQuest Helper'}</b><br>${esc(m.text)}</div>`).join('');return `${heading('OFFLINE STUDY HELPER','کمک‌یار آفلاین','جست‌وجو در بانک محتوای همین سایت و نمایش نکته‌های درسی؛ نه یک مدل هوش مصنوعی آنلاین.')}<section class="panel"><div class="static-chat" id="static-chat">${chat||'<div class="static-empty">مثلاً معنی یک واژه را بپرس یا دربارهٔ do و does سؤال کن.</div>'}</div><form id="helper-form" class="ai-composer"><textarea class="textarea" name="message" rows="2" maxlength="500" placeholder="مثلاً تفاوت do و does چیست؟" required></textarea><button class="btn btn-primary">جست‌وجو ↗</button></form><div class="static-card-actions"><button class="chip-btn" data-action="helper-prompt" data-prompt="تفاوت do و does چیست؟">do و does</button><button class="chip-btn" data-action="helper-prompt" data-prompt="am is are را توضیح بده">am / is / are</button><button class="chip-btn" data-action="helper-prompt" data-prompt="گذشتهٔ ساده را توضیح بده">گذشتهٔ ساده</button></div></section>`;}
function helperAnswer(message){
  const q=message.toLocaleLowerCase();
  const word=D.vocabulary.find(w=>w.word.toLocaleLowerCase()===q||w.meaning.toLocaleLowerCase()===q);
  if(word)return `واژه: ${word.word}\nمعنی: ${word.meaning}\nتلفظ: ${word.ipa||'در منبع ثبت نشده'}\nمثال: ${word.example_en}\nترجمه: ${word.example_fa}`;
  const topic=q.includes('do')||q.includes('does')?D.grammar[2]:q.includes('am')||q.includes('is')||q.includes('are')||q.includes('to be')?D.grammar[0]:q.includes('continuous')||q.includes('استمراری')?D.grammar[1]:q.includes('wh')||q.includes('پرسشی')?D.grammar[3]:q.includes('گذشته')||q.includes('past')?D.grammar[4]:null;
  if(topic){const units=D.lessonGuides.find(x=>x.lesson_id===topic.lesson_id)?.grammar_units||[];return `${topic.title}\n${topic.summary}\n\nفرمول:\n${topic.formula}\n\nکاربرد: ${topic.usage}\n\nاشتباه رایج: ${topic.common_errors}\n\nنکته‌های تکمیلی: ${units.map(u=>u.title).join('، ')}`;}
  const matches=D.vocabulary.filter(w=>w.word.toLocaleLowerCase().includes(q)||w.meaning.toLocaleLowerCase().includes(q)).slice(0,5);
  if(matches.length)return `چند نتیجهٔ نزدیک در بانک واژگان:\n${matches.map(w=>`${w.word} — ${w.meaning}`).join('\n')}\n\nبرای جست‌وجوی دقیق‌تر، واژه را کوتاه‌تر یا دقیق‌تر بنویس.`;
  return 'در داده‌های آفلاین، پاسخ مستقیمی برای این پرسش پیدا نکردم. می‌توانی نام یک واژه، عنوان گرامر یا بخشی از عبارت را جست‌وجو کنی. این کمک‌یار به اینترنت یا مدل زبانی متصل نیست.';
}
function renderEnglish(){return `${heading('ENGLISH CORNER','گوشهٔ انگلیسی','الگوهای مکالمهٔ ثبت‌شده برای موقعیت‌های روزمره.') }<div class="static-grid">${D.phraseBank.map(p=>`<article class="static-card"><span class="pill">درس ${p.lesson_id}</span><h3>${esc(p.name)}</h3><div class="static-example"><b>${esc(p.pattern)}</b><small>${esc(p.fa)}</small></div><p class="ltrline">${esc(p.reply)}</p><button class="btn btn-soft btn-sm" data-action="speak" data-text="${esc(p.pattern+' '+p.reply)}">🔊 شنیدن</button></article>`).join('')}</div>`;}
function renderTips(){const tips=[['مرور فاصله‌دار','واژه را در چند روز مختلف مرور کن تا فاصلهٔ یادآوری به‌تدریج بیشتر شود.'],['یادآوری فعال','پیش از دیدن معنی، ابتدا از حافظه برای به‌یادآوردن آن تلاش کن.'],['جمله‌سازی','هر واژه را در یک جملهٔ ساده و مربوط به زندگی روزمره به کار ببر.'],['خواندن با صدای بلند','به تلفظ، مکث و آهنگ جمله توجه کن.'],['یادداشت اشتباه‌ها','اشتباه‌های آزمون را دوباره تمرین کن؛ همان‌ها راهنمای مطالعهٔ بعدی‌اند.'],['هدف کوچک','یک هدف واقع‌بینانه و کوتاه برای هر روز انتخاب کن.']];return `${heading('STUDY BOOST','نکات طلایی','روش‌های ساده برای ساخت عادت یادگیری.') }<div class="static-grid">${tips.map(([title,desc],i)=>`<article class="static-card"><span class="pill">نکته ${i+1}</span><h3>${title}</h3><p>${desc}</p></article>`).join('')}</div>`;}
function renderBackup(){return `${heading('YOUR DATA','پشتیبان و تنظیمات داده','پیشرفت، علاقه‌مندی‌ها، برنامه و پیش‌نویس را در یک فایل JSON پشتیبان بگیر.') }<section class="panel"><div class="static-card-actions"><button class="btn btn-primary" data-action="export-data">دریافت پشتیبان JSON ↓</button><button class="btn btn-outline" data-action="import-data">بازیابی پشتیبان JSON ↑</button><input type="file" id="import-file" accept="application/json" hidden></div><div class="static-source">پشتیبان فقط شامل اطلاعاتی است که در همین مرورگر ثبت کرده‌ای. آن را در مخزن عمومی GitHub قرار نده؛ فایل پشتیبان ممکن است نام نمایشی و سابقهٔ مطالعه‌ات را داشته باشد.</div><hr><h3>بازنشانی محلی</h3><p class="small muted">این کار فقط داده‌های محلی LexiQuest 9 را از این مرورگر پاک می‌کند و برگشت‌پذیر نیست؛ قبل از آن پشتیبان بگیر.</p><button class="btn btn-danger" data-action="clear-progress">پاک‌کردن پیشرفت محلی</button></section>`;}
function renderProfile(){return `${heading('LOCAL PROFILE','تنظیمات محلی','این نسخه حساب کاربری آنلاین ندارد؛ نام و هدف فقط برای نمایش در مرورگر ذخیره می‌شود.')}${notice()}<section class="panel"><form id="profile-form" class="form-grid"><div class="form-field"><label class="label">نام نمایشی</label><input class="field" name="displayName" maxlength="30" value="${esc(state.displayName)}"></div><div class="form-field"><label class="label">هدف روزانه (دقیقه)</label><select class="select" name="dailyGoal">${[5,10,15,20,30,45,60].map(n=>`<option value="${n}" ${state.dailyGoal===n?'selected':''}>${faNum(n)} دقیقه</option>`).join('')}</select></div><div class="form-field full"><button class="btn btn-primary">ذخیرهٔ تنظیمات</button><button class="btn btn-outline" type="button" data-action="view" data-view="more">بخش امکانات بیشتر</button></div></form><div class="static-source">هیچ نام کاربری یا گذرواژه‌ای ساخته نمی‌شود. پاک‌کردن داده‌های مرورگر یا استفاده از دستگاه دیگر، پیشرفت را منتقل نمی‌کند؛ برای انتقال از فایل پشتیبان JSON استفاده کن.</div></section>`;}
function renderSearch(){
  const q=(state.searchQuery||'').toLocaleLowerCase();if(!q)return `${heading('GLOBAL SEARCH','جست‌وجو','برای پیدا کردن واژه، معنی، نکتهٔ گرامری یا متن، عبارتت را وارد کن.')}<div class="static-empty">عبارت جست‌وجو خالی است.</div>`;
  const words=D.vocabulary.filter(w=>[w.word,w.meaning,w.example_en,w.example_fa].join(' ').toLocaleLowerCase().includes(q)).slice(0,40);
  const grammar=D.grammar.filter(g=>[g.title,g.summary,g.formula,g.usage].join(' ').toLocaleLowerCase().includes(q));
  const readings=D.readingTexts.filter(r=>[r.title,r.text,r.translation].join(' ').toLocaleLowerCase().includes(q));
  const lessons=D.lessons.filter(l=>[l.title,l.theme].join(' ').toLocaleLowerCase().includes(q));
  return `${heading('GLOBAL SEARCH',`نتایج «${esc(state.searchQuery)}»`,'جست‌وجو در داده‌های آموزشی ذخیره‌شده داخل سایت.') }<div class="section-row"><h2>واژگان (${faNum(words.length)})</h2></div><div class="grid vocab-grid">${words.map(w=>wordCard({...w,_index:D.vocabulary.indexOf(w)})).join('')||'<div class="static-empty">واژه‌ای پیدا نشد.</div>'}</div><div class="section-row"><h2>گرامر (${faNum(grammar.length)})</h2></div><div class="grammar-list">${grammar.map(grammarCard).join('')||'<div class="static-empty">مبحثی پیدا نشد.</div>'}</div><div class="section-row"><h2>متن‌ها (${faNum(readings.length)})</h2></div><div class="static-grid">${readings.map(r=>`<article class="static-card"><h3>${esc(r.title)}</h3><p>${esc(r.text)}</p></article>`).join('')||'<div class="static-empty">متنی پیدا نشد.</div>'}</div><div class="section-row"><h2>درس‌ها</h2></div><div class="static-grid">${lessons.map(l=>`<button class="static-card" data-action="open-lesson" data-lesson="${l.id}"><h3>درس ${l.id} · ${esc(l.title)}</h3><p>${esc(l.theme)}</p></button>`).join('')||'<div class="static-empty">درسی پیدا نشد.</div>'}</div>`;
}
function openLesson(lessonId,tab='map'){
  state.view='learn';state.learnTab=tab;state.filters.lesson=String(lessonId);state.selectedLesson=tab==='map'?Number(lessonId):null;saveState();render();window.scrollTo({top:0,behavior:'smooth'});
}
function openReading(id){
  const reading=D.readingTexts.find(r=>r.id===id);if(!reading)return;
  state.quiz={mode:'reading',lesson:reading.lesson_id,questions:reading.questions.map((q,i)=>({id:`${reading.id}-${i}`,type:'reading',prompt:q.prompt,context:reading.text,options:q.options,correct_index:q.answer,explanation:q.explanation})),startedAt:Date.now()};state.quizAnswers={};state.questionIndex=0;state.view='quiz';saveState();render();
}
function downloadFile(filename,content,mime='application/json'){
  const blob=new Blob([content],{type:mime});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();URL.revokeObjectURL(url);
}
function exportData(){
  const payload={format:'LexiQuest9-local-backup-v1',exportedAt:new Date().toISOString(),progress:{displayName:state.displayName,dailyGoal:state.dailyGoal,theme:state.theme,favorites:state.favorites,wordProgress:state.wordProgress,grammarProgress:state.grammarProgress,attempts:state.attempts,wrongQuestionIds:state.wrongQuestionIds,activeDays:state.activeDays,completedTasks:state.completedTasks,writing:state.writing}};
  downloadFile(`lexiquest9-backup-${dayKey()}.json`,JSON.stringify(payload,null,2));toast('فایل پشتیبان آماده شد.','success');
}
function importDataObject(payload){
  if(payload?.format!=='LexiQuest9-local-backup-v1'||!payload.progress||typeof payload.progress!=='object')throw new Error('ساختار فایل پشتیبان معتبر نیست.');
  const p=payload.progress;
  state.displayName=typeof p.displayName==='string'?p.displayName.slice(0,30):state.displayName;
  state.dailyGoal=[5,10,15,20,30,45,60].includes(Number(p.dailyGoal))?Number(p.dailyGoal):state.dailyGoal;
  state.theme=p.theme==='dark'?'dark':'light';
  state.favorites=Array.isArray(p.favorites)?[...new Set(p.favorites.filter(x=>Number.isInteger(x)&&x>=0&&x<D.vocabulary.length))]:[];
  state.wordProgress=p.wordProgress&&typeof p.wordProgress==='object'&&!Array.isArray(p.wordProgress)?p.wordProgress:{};
  state.grammarProgress=p.grammarProgress&&typeof p.grammarProgress==='object'&&!Array.isArray(p.grammarProgress)?p.grammarProgress:{};
  state.attempts=Array.isArray(p.attempts)?p.attempts.filter(a=>a&&typeof a==='object'&&Number.isFinite(a.accuracy)&&Number.isFinite(a.correct)&&Number.isFinite(a.total)).slice(0,100):[];
  const validQuestionIds=new Set(D.questions.map(q=>q.id));
  state.wrongQuestionIds=Array.isArray(p.wrongQuestionIds)?[...new Set(p.wrongQuestionIds.filter(id=>validQuestionIds.has(id)))]:[];
  state.activeDays=Array.isArray(p.activeDays)?p.activeDays.filter(x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)).slice(-60):[];
  state.completedTasks=Array.isArray(p.completedTasks)?p.completedTasks.filter(x=>typeof x==='string'&&x.length<=40).slice(-300):[];
  state.writing=typeof p.writing==='string'?p.writing.slice(0,5000):'';
  state.quiz=null;state.quizAnswers={};state.result=null;state.view='home';
  saveState();staticallyApplyTheme();render();toast('پشتیبان بازیابی شد.','success');
}
function navigate(view){state.view=view;state.result=null;saveState();render();window.scrollTo({top:0,behavior:'smooth'});}

app.addEventListener('click',event=>{
  const button=event.target.closest('[data-action]');if(!button)return;
  const action=button.dataset.action;
  if(action==='view')navigate(button.dataset.view||'home');
  else if(action==='theme'){state.theme=state.theme==='dark'?'light':'dark';document.body.classList.toggle('dark',state.theme==='dark');saveState();render();}
  else if(action==='learn-tab'){state.learnTab=button.dataset.key;state.filters.lesson='';state.selectedLesson=null;state.vocabPage=0;saveState();render();}
  else if(action==='more-tab'){state.moreTab=button.dataset.key;saveState();render();}
  else if(action==='open-lesson')openLesson(Number(button.dataset.lesson),'map');
  else if(action==='open-lesson-grammar')openLesson(Number(button.dataset.lesson),'grammar');
  else if(action==='open-lesson-vocabulary'){state.filters.lesson=String(button.dataset.lesson);state.filters.q='';state.filters.status='';state.filters.favorite=false;state.view='learn';state.learnTab='vocabulary';state.selectedLesson=null;saveState();render();}
  else if(action==='back-lessons'){state.selectedLesson=null;saveState();render();}
  else if(action==='choose-quiz'){state.quizMode=button.dataset.mode;state.quizLesson='';saveState();startQuiz(state.quizMode,'',10,'mixed');}
  else if(action==='start-quiz')startQuiz(button.dataset.mode||'smart',button.dataset.lesson||'',state.quizCount,state.quizDifficulty);
  else if(action==='favorite'){const i=Number(button.dataset.index);state.favorites=state.favorites.includes(i)?state.favorites.filter(x=>x!==i):[...state.favorites,i];saveState();render();}
  else if(action==='hide-meaning'){const i=Number(button.dataset.index);state.hiddenMeanings=state.hiddenMeanings.includes(i)?state.hiddenMeanings.filter(x=>x!==i):[...state.hiddenMeanings,i];saveState();render();}
  else if(action==='review-word'){const w=D.vocabulary[Number(button.dataset.index)];if(!w)return;state.wordProgress[wordKey(w)]=nextVocabularyState(getWordProgress(w),button.dataset.rating==='known');touchToday();saveState();render();toast(button.dataset.rating==='known'?'مرور موفق ثبت شد.':'واژه برای مرور دوباره علامت خورد.','success');}
  else if(action==='grammar-status'){const l=button.dataset.lesson;const p=state.grammarProgress[l]||{correct:0,wrong:0};p.status=button.dataset.status;state.grammarProgress[l]=p;saveState();render();toast('وضعیت گرامر ذخیره شد.','success');}
  else if(action==='speak')speak(button.dataset.text||'');
  else if(action==='listen-play'){const p=D.phraseBank[Number(state.listeningIndex||0)%D.phraseBank.length];speak(`${p.pattern}. ${p.reply}`);}
  else if(action==='listen-toggle'){state.listeningHidden=state.listeningHidden===false?true:false;saveState();render();}
  else if(action==='listen-next'){state.listeningIndex=(Number(state.listeningIndex||0)+1)%D.phraseBank.length;state.listeningHidden=true;saveState();render();}
  else if(action==='vocab-page'){state.vocabPage=Math.max(0,state.vocabPage+(button.dataset.dir==='next'?1:-1));render();}
  else if(action==='clear-vocab-filter'){state.filters={q:'',lesson:'',status:'',pos:'',favorite:false};state.vocabPage=0;saveState();render();}
  else if(action==='answer'){if(!state.quiz)return;const q=state.quiz.questions[state.questionIndex];state.quizAnswers={...(state.quizAnswers||{}),[q.id]:Number(button.dataset.index)};render();}
  else if(action==='quiz-prev'){state.questionIndex=Math.max(0,state.questionIndex-1);render();}
  else if(action==='quiz-next'){if(state.questionIndex>=state.quiz.questions.length-1)finishQuiz();else{state.questionIndex++;render();}}
  else if(action==='quiz-cancel'){if(confirm('از آزمون خارج شوی؟ پاسخ‌های این نوبت ثبت نمی‌شوند.')){state.quiz=null;state.quizAnswers={};navigate('quizzes');}}
  else if(action==='retry-mistakes')startQuiz('mistakes','',10,'mixed');
  else if(action==='reading-questions')openReading(button.dataset.id);
  else if(action==='writing-check'){state.writingHint=true;saveState();render();}
  else if(action==='writing-example'){state.writing='My friend is kind and hard-working. He is quiet, but he is always helpful.';saveState();render();}
  else if(action==='planner-launch'){const task=button.dataset.task;if(task==='vocab'){state.view='learn';state.learnTab='vocabulary';state.filters.status='weak';render();}else if(task==='grammar'){openLesson(1,'grammar');}else if(task==='quiz'){navigate('quizzes');}else if(task==='reading'){state.view='learn';state.learnTab='reading';render();}}
  else if(action==='planner-complete'){const key=`${dayKey()}-${button.dataset.task}`;if(!state.completedTasks.includes(key))state.completedTasks.push(key);touchToday();saveState();render();toast('فعالیت در برنامهٔ محلی ثبت شد.','success');}
  else if(action==='export-data')exportData();
  else if(action==='import-data')document.getElementById('import-file')?.click();
  else if(action==='clear-progress'){if(confirm('تمام پیشرفت و تنظیمات ذخیره‌شده در این مرورگر پاک شود؟ ابتدا پشتیبان بگیر.')){localStorage.removeItem(STORAGE_KEY);state=loadState();document.body.classList.remove('dark');render();toast('داده‌های محلی پاک شدند.','success');}}
  else if(action==='helper-prompt'){state.chat.push({role:'user',text:button.dataset.prompt},{role:'bot',text:helperAnswer(button.dataset.prompt)});saveState();render();}
});

app.addEventListener('submit',event=>{
  const form=event.target;
  if(form.id==='global-search-form'){event.preventDefault();state.searchQuery=form.querySelector('input').value.trim();navigate('search');}
  else if(form.id==='vocab-filter-form'){
    event.preventDefault();const fd=new FormData(form);state.filters={q:String(fd.get('q')||'').trim(),lesson:String(fd.get('lesson')||''),status:String(fd.get('status')||''),pos:String(fd.get('pos')||''),favorite:fd.get('favorite')==='on'};state.vocabPage=0;saveState();render();
  }
  else if(form.id==='quiz-setup'){
    event.preventDefault();const fd=new FormData(form);state.quizMode=String(fd.get('mode'));state.quizLesson=String(fd.get('lesson')||'');state.quizDifficulty=String(fd.get('difficulty'));state.quizCount=Number(fd.get('count'))||10;saveState();startQuiz(state.quizMode,state.quizLesson,state.quizCount,state.quizDifficulty);
  }
  else if(form.id==='goal-form'){event.preventDefault();state.dailyGoal=Number(new FormData(form).get('goal'))||10;saveState();render();toast('هدف روزانه ذخیره شد.','success');}
  else if(form.id==='writing-form'){event.preventDefault();state.writing=String(new FormData(form).get('writing')||'');state.writingHint=false;saveState();render();toast('پیش‌نویس در همین مرورگر ذخیره شد.','success');}
  else if(form.id==='helper-form'){event.preventDefault();const msg=String(new FormData(form).get('message')||'').trim();if(msg){state.chat.push({role:'user',text:msg},{role:'bot',text:helperAnswer(msg)});state.chat=state.chat.slice(-30);saveState();render();}}
  else if(form.id==='pronounce-form'){event.preventDefault();const phrase=String(new FormData(form).get('phrase')||'').trim();if(phrase)speak(phrase);}
  else if(form.id==='profile-form'){event.preventDefault();const fd=new FormData(form);state.displayName=String(fd.get('displayName')||'قهرمان').trim().slice(0,30)||'قهرمان';state.dailyGoal=Number(fd.get('dailyGoal'))||10;saveState();render();toast('تنظیمات ذخیره شد.','success');}
});

app.addEventListener('change',event=>{
  if(event.target.id==='grammar-lesson'){state.filters.lesson=event.target.value;saveState();render();}
  if(event.target.id==='irregular-search'){state.irregularQuery=event.target.value;const pos=event.target.selectionStart;render();const next=document.getElementById('irregular-search');if(next){next.focus();next.setSelectionRange(pos,pos);}}
  if(event.target.id==='import-file'){
    const file=event.target.files?.[0];if(!file)return;const reader=new FileReader();reader.onload=()=>{try{importDataObject(JSON.parse(String(reader.result)));}catch(e){toast(e.message||'فایل قابل بازیابی نیست.','error');}};reader.readAsText(file);
  }
});

function staticallyApplyTheme(){document.body.classList.toggle('dark',state.theme==='dark');}
async function boot(){
  staticallyApplyTheme();
  try{
    const response=await fetch(DATA_URL,{cache:'no-cache'});if(!response.ok)throw new Error(`HTTP ${response.status}`);
    D=await response.json();
    if(!D.lessons||D.lessons.length!==6||D.vocabulary.length!==245||D.questions.length!==91)throw new Error('بررسی ساختار داده‌های آموزشی ناموفق بود.');
    render();
    if('serviceWorker' in navigator && location.protocol!=='file:')navigator.serviceWorker.register('./sw.js').catch(()=>{});
  }catch(error){app.innerHTML=`<div class="boot"><div class="brand-symbol">LQ</div><h2>بارگذاری ناموفق بود</h2><p>فایل static-data.json در دسترس نیست یا ساختار آن معتبر نیست.</p><p class="tiny muted">${esc(error.message)}</p></div>`;}
}
boot();
