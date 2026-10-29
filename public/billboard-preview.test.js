'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const app=require('./billboard-preview.js');
const html=fs.readFileSync(path.join(__dirname,'billboard.html'),'utf8');

test('all one hundred slots are illustrated without inventing sold positions',()=>{
 const slots=app.boardSlots();
 assert.equal(slots.length,100);
 assert.deepEqual(slots.filter(x=>x.demo),[{number:45,demo:true}]);
 assert.equal(slots[0].number,1);
 assert.equal(slots[99].number,100);
});

test('complete proposed text is retained, not first few letters',()=>{
 const sample='A long label for a real New Zealand local community and art project';
 assert.equal(app.titleOf(sample),sample);
 assert.equal(app.titleOf('X'.repeat(80)).length,80);
 assert.equal(app.titleOf('X'.repeat(81)).length,80);
 assert.equal(app.titleOf(''), 'YOUR IDEA HERE');
});

test('small actual-size text is differentiated from enlarged mockup',()=>{
 const short=app.fontSizes(8), long=app.fontSizes(80);
 assert.ok(short.actual>long.actual);
 assert.ok(short.enlarged>long.enlarged);
 assert.ok(app.readability(80).includes('100 by 100 pixels'));
});

test('preview includes whole board, zoom, actual size and full label',()=>{
 for(const id of ['sample-board','tile-text','tile-actual','full-label','sample-count','legibility-warning'])
   assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(html,/100 positions/);
 assert.match(html,/Actual size/);
 assert.match(html,/billboard-preview.js/);
 assert.match(html,/The 100-position board above is illustrative only/);
 assert.doesNotMatch(html,/class="screen"|function\(\)\{'use strict';const input=document.getElementById\('sample'\)/);
});

test('preview never changes the existing live payment link or claims slots sold',()=>{
 assert.match(html,/buy\.stripe\.com\/00w4gz6HzeWhcizeZedwc2w/);
 assert.match(html,/unpaid illustration/);
 assert.match(html,/not a reserved or available slot/);
});

test('live editor updates exact title without HTML interpretation',()=>{
 function makeText(){
   let value='';
   return {style:{},parentElement:{clientHeight:250,clientWidth:250,classList:{contains:()=>false}},
     scrollHeight:45,scrollWidth:100,
     get textContent(){return value},set textContent(x){value=String(x)}};
 }
 const zoomText=makeText(),actualText=makeText();
 const input={value:'Initial example',listeners:{},addEventListener(k,fn){this.listeners[k]=fn}};
 const board={children:[],replaceChildren(){this.children=[]},appendChild(f){this.children=f.children}};
 const zoom={querySelector(){return zoomText},setAttribute(){}};
 const actual={querySelector(){return actualText},setAttribute(){}};
 const full={textContent:''},advice={textContent:''},counter={textContent:''};
 const ids={sample:input,'sample-board':board,'tile-text':zoom,'tile-actual':actual,
            'full-label':full,'legibility-warning':advice,'sample-count':counter};
 const doc={
   getElementById:id=>ids[id],
   createDocumentFragment:()=>({children:[],appendChild(x){this.children.push(x)}}),
   createElement:()=>({className:'',textContent:'',title:'',setAttribute(){}})
 };
 app.mount(doc);
 assert.equal(board.children.length,100);
 const dangerous='<b>This is my entire project name and brand</b>';
 input.value=dangerous;
 input.listeners.input();
 assert.equal(full.textContent,dangerous);
 assert.equal(zoomText.textContent,dangerous);
 assert.equal(actualText.textContent,dangerous);
 assert.equal(counter.textContent,dangerous.length+' / 80 characters');
 assert.ok(board.children[44].title.includes(dangerous));
 assert.equal(board.children.filter(x=>x.className.includes('board-sample')).length,1);
});
