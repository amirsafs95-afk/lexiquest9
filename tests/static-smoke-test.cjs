const fs=require('fs'),vm=require('vm'),path=require('path');
const root=path.resolve(__dirname,'..');
const data=JSON.parse(fs.readFileSync(path.join(root,'static-data.json'),'utf8'));
const code=fs.readFileSync(path.join(root,'static-app.js'),'utf8');
const listeners={};const app={innerHTML:'',addEventListener:(n,fn)=>listeners[n]=fn};const toast={append(){}};
const classes=new Set();const document={getElementById:id=>id==='app'?app:id==='toast'?toast:null,body:{classList:{toggle:(c,v)=>{if(v)classes.add(c);else classes.delete(c);},remove:c=>classes.delete(c)}},createElement:()=>({style:{},remove(){},click(){}}),body:{classList:{toggle:(c,v)=>{if(v)classes.add(c);else classes.delete(c);},remove:c=>classes.delete(c)},append(){}}};
const storage=new Map();const ctx={console,document,window:{scrollTo(){}},navigator:{},location:{protocol:'http:'},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},fetch:async()=>({ok:true,json:async()=>data}),setTimeout,clearTimeout,Date,Intl,Math,JSON,Map,Set,Array,Object,String,Number,Boolean,RegExp,Error,Blob:class{},URL:{createObjectURL(){return''},revokeObjectURL(){}},confirm:()=>true,FileReader:class{},FormData:class{constructor(){ }get(){return''}},
};
vm.runInNewContext(code,ctx,{filename:'static-app.js'});
const wait=()=>new Promise(r=>setTimeout(r,10));
const click=async dataset=>{listeners.click({target:{closest:()=>({dataset})}});await wait();};
(async()=>{
 await wait();
 const checks=[];
 const check=(name,ok)=>{checks.push({name,ok});if(!ok)throw new Error('FAIL '+name)};
 check('initial home rendered',app.innerHTML.includes('نقشهٔ شش‌مرحله‌ای'));
 await click({action:'view',view:'learn'});check('learn map renders',app.innerHTML.includes('آزمایشگاه یادگیری'));
 for(const key of ['vocabulary','grammar','phrases','reviews','irregular','reading','speaking','listening','map']){await click({action:'learn-tab',key});check(`learn tab ${key}`,app.innerHTML.length>1500);}
 // Select a lesson detail and test its navigation.
 await click({action:'open-lesson',lesson:'1'});check('lesson detail',app.innerHTML.includes('تمرین مهارت‌ها'));
 await click({action:'open-lesson-grammar',lesson:'2'});check('lesson grammar',app.innerHTML.includes('Present Continuous'));
 for(const key of ['planner','writing','helper','english','tips','backup']){await click({action:'view',view:'more'});await click({action:'more-tab',key});check(`more tab ${key}`,app.innerHTML.length>1000);}
 await click({action:'more-tab',key:'writing'});await click({action:'writing-check'});check('writing checklist',app.innerHTML.includes('چک‌لیست خودارزیابی'));await click({action:'writing-example'});check('writing example',app.innerHTML.includes('My friend is kind'));
 await click({action:'more-tab',key:'helper'});await click({action:'helper-prompt',prompt:'تفاوت do و does چیست؟'});check('offline helper response',app.innerHTML.includes('Simple Present')||app.innerHTML.includes('Simple Present Tense')||app.innerHTML.includes('does'));
 await click({action:'more-tab',key:'planner'});await click({action:'planner-complete',task:'vocab'});check('planner task saved',app.innerHTML.includes('تکمیل شد'));
 await click({action:'view',view:'learn'});await click({action:'learn-tab',key:'listening'});await click({action:'listen-toggle'});check('listening text reveal',app.innerHTML.includes('پنهان‌کردن متن'));await click({action:'listen-next'});check('listening next phrase',app.innerHTML.includes('نمایش متن و معنی'));
 await click({action:'view',view:'profile'});check('profile rendered',app.innerHTML.includes('تنظیمات محلی'));
 await click({action:'view',view:'progress'});check('progress rendered',app.innerHTML.includes('تسلط واژگان در هر درس'));
 await click({action:'view',view:'quizzes'});check('quiz menu rendered',app.innerHTML.includes('میدان آزمون'));
 await click({action:'start-quiz',mode:'vocabulary'});check('quiz launched',app.innerHTML.includes('سؤال ۱ از'));
 // Answer all current questions with first option and submit through last button.
 for(let i=0;i<10;i++){await click({action:'answer',index:'0'});await click({action:'quiz-next'});}
 check('quiz results rendered',app.innerHTML.includes('گزارش آزمون'));await click({action:'view',view:'progress'});check('first quiz achievement',app.innerHTML.includes('اولین مأموریت'));
 await click({action:'view',view:'search'});check('search screen renders',app.innerHTML.includes('جست‌وجو'));
 for(const mode of ['translation','grammar','lesson','comprehensive','mistakes','exam','challenge','irregular','reading','smart']){await click({action:'start-quiz',mode,lesson:'1'});check(`quiz mode ${mode}`,app.innerHTML.includes('سؤال ۱ از'));await click({action:'quiz-cancel'});}
 await click({action:'view',view:'learn'});await click({action:'learn-tab',key:'vocabulary'});await click({action:'favorite',index:'0'});check('favorite toggle works',app.innerHTML.includes('♥'));await click({action:'review-word',index:'0',rating:'known'});check('word review updates',app.innerHTML.includes('در حال یادگیری')||app.innerHTML.includes('مسلط'));
 console.log('PASS',checks.length,checks);
})().catch(e=>{console.error(e);process.exitCode=1;});
