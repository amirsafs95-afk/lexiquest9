import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const required = ['index.html','static-app.js','static-data.json','styles.css','static.css','fantasy.css','sw.js','manifest.webmanifest','icon.svg'];
const errors = [];
for (const file of required) if (!fs.existsSync(path.join(root,file))) errors.push(`Missing: ${file}`);
const data = JSON.parse(fs.readFileSync(path.join(root,'static-data.json'),'utf8'));
const expected = {lessons:6,vocabulary:245,grammar:6,questions:91,irregularVerbs:59,readingTexts:3,phraseBank:18,reviewUnits:3};
for (const [key,count] of Object.entries(expected)) if (data[key]?.length !== count) errors.push(`${key}: expected ${count}, got ${data[key]?.length}`);
const ids = data.questions.map(q=>q.id);
if (new Set(ids).size !== ids.length) errors.push('Duplicate quiz-question IDs');
for (const q of data.questions) if (!Array.isArray(q.options) || !Number.isInteger(q.correct_index) || q.correct_index < 0 || q.correct_index >= q.options.length) errors.push(`Invalid question: ${q.id}`);
for (const v of data.irregularVerbs) if (!v.example_en || /it yesterday/i.test(v.example_en)) errors.push(`Uncorrected example: ${v.base}`);
const html = fs.readFileSync(path.join(root,'index.html'),'utf8');
for (const ref of ['./styles.css','./static.css','./fantasy.css','./static-app.js','./manifest.webmanifest','./icon.svg']) if (!html.includes(ref)) errors.push(`index.html missing relative ref ${ref}`);
if (/(?:src|href)="\/(?!\/)/.test(html)) errors.push('Root-absolute asset path found in index.html');
for (const forbidden of ['server','database','data','backups','.env']) if (fs.existsSync(path.join(root,forbidden))) errors.push(`Sensitive/server directory included: ${forbidden}`);
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log('LexiQuest 9 static verification passed.');
console.log(JSON.stringify(expected,null,2));
