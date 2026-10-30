'use strict';
// Browser/Node deterministic CSV normalizer: no requests, storage, AI, or external packages.
(function(root,factory){const lib=factory();if(typeof module==='object'&&module.exports)module.exports=lib;root.BECKRescue=lib;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 const MAX_ROWS=5000,MAX_COLS=100,MAX_BYTES=3*1024*1024;
 function parseCsv(raw){
  if(typeof raw!=='string'||!raw.length)throw Error('EMPTY_CSV');
  if(new TextEncoder().encode(raw).length>MAX_BYTES)throw Error('FILE_TOO_LARGE');
  if(raw.charCodeAt(0)===0xfeff)raw=raw.slice(1);
  const rows=[];let row=[],cell='',quoted=false,endedQuote=false;
  for(let i=0;i<raw.length;i++){
   const ch=raw[i];
   if(quoted){if(ch==='"'){if(raw[i+1]==='"'){cell+='"';i++;}else {quoted=false;endedQuote=true;}}else cell+=ch;continue;}
   if(endedQuote&&ch!==','&&ch!=='\n'&&ch!=='\r')throw Error('BAD_QUOTE_BOUNDARY');
   if(ch==='"'){if(cell.length||endedQuote)throw Error('BAD_QUOTE');quoted=true;continue;}
   if(ch===','){row.push(cell);cell='';endedQuote=false;if(row.length>MAX_COLS)throw Error('TOO_MANY_COLUMNS');continue;}
   if(ch==='\n'||ch==='\r'){row.push(cell);rows.push(row);if(rows.length>MAX_ROWS+2)throw Error('TOO_MANY_ROWS');row=[];cell='';endedQuote=false;if(ch==='\r'&&raw[i+1]==='\n')i++;continue;}
   cell+=ch;
  }
  if(quoted)throw Error('UNTERMINATED_QUOTE');
  if(cell!==''||row.length||endedQuote){row.push(cell);rows.push(row);}
  if(!rows.length)throw Error('EMPTY_CSV');
  if(rows.some(r=>r.length!==rows[0].length))throw Error('RAGGED_CSV');
  if(rows[0].length>MAX_COLS)throw Error('TOO_MANY_COLUMNS');
  return rows;
 }
 function escapeFormula(s){return /^[\s\u0000-\u001f]*[=+\-@]/.test(s)?"'"+s:s;}
 function encodeCsv(rows){return rows.map(row=>row.map(v=>{const s=String(v);return /[",\n\r]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;}).join(',')).join('\r\n')+'\r\n';}
 function transform(raw){
  const rows=parseCsv(raw);if(rows.length<2)throw Error('NO_DATA_ROWS');
  const headers=rows[0].map(c=>c.trim());if(headers.some(c=>!c))throw Error('EMPTY_HEADER');
  if(new Set(headers.map(h=>h.toLowerCase())).size!==headers.length)throw Error('DUPLICATE_HEADER');
  let blanks=0,duplicates=0,trimmed=0,escaped=0;const output=[headers.map(v=>{const safe=escapeFormula(v);if(safe!==v)escaped++;return safe;})];const seen=new Set();
  for(let i=1;i<rows.length;i++){
   const r=rows[i],clean=r.map(c=>{const v=c.trim();if(v!==c)trimmed++;return v;});
   if(clean.every(v=>!v)){blanks++;continue;}
   const key=JSON.stringify(clean);if(seen.has(key)){duplicates++;continue;}seen.add(key);
   output.push(clean.map(v=>{const safe=escapeFormula(v);if(safe!==v)escaped++;return safe;}));
  }
  const cleanCsv=encodeCsv(output);const report={schema:'BECK/CSV-RESCUE/v1',mode:'BROWSER_LOCAL',input_rows:rows.length-1,output_rows:output.length-1,duplicate_rows_removed:duplicates,blank_rows_removed:blanks,cells_trimmed:trimmed,formula_cells_escaped:escaped,columns:headers.length,policy:'Trim cells; remove blank rows and exact duplicate normalized rows; prefix potentially executable spreadsheet formulas with apostrophe. No date, amount or category inference.',validation:rows.length-1===output.length-1+duplicates+blanks};
  if(!report.validation)throw Error('ROW_CONSERVATION_FAILED');
  return {csv:cleanCsv,report,preview:output.slice(0,6)};
 }
 return {parseCsv,encodeCsv,transform,MAX_ROWS,MAX_COLS,MAX_BYTES};
});