const STEP='    ';

const KEYWORDS=new Set('False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield'.split(' '));
const BUILTINS=new Set('abs all any bool dict enumerate float int len list max min print range reversed round set sorted str sum tuple zip'.split(' '));
const identifier=/[\p{L}_][\p{L}\p{N}_]*/uy;
const number=/(?:0[xX][\da-fA-F_]+|0[bB][01_]+|0[oO][0-7_]+|(?:\d[\d_]*(?:\.[\d_]*)?|\.\d[\d_]*)(?:[eE][+-]?[\d_]+)?)[jJ]?/y;
const escapeHTML=text=>text.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// Display only: incomplete Python is welcome here. Never parse, execute or
// rewrite the program; even f-strings are simply displayed as whole strings.
export function highlightPython(source){
  const output=[];
  const token=(kind,text)=>output.push(kind?`<span class="python-token-${kind}">${escapeHTML(text)}</span>`:escapeHTML(text));
  for(let at=0;at<source.length;){
    const start=at,c=source[at];
    if(c==='#'){
      const end=source.indexOf('\n',at);at=end<0?source.length:end;token('comment',source.slice(start,at));continue;
    }
    const prefix=/^(?:[rRuUbBfF]{1,2})?(?=['"])/.exec(source.slice(at));
    if(prefix){
      at+=prefix[0].length;const quote=source[at],triple=source.slice(at,at+3)===quote.repeat(3),delimiter=triple?quote.repeat(3):quote;
      at+=delimiter.length;
      while(at<source.length){
        if(source[at]==='\\'){at=Math.min(source.length,at+2);continue;}
        if(source.startsWith(delimiter,at)){at+=delimiter.length;break;}
        if(!triple&&source[at]==='\n')break;
        at++;
      }
      token('string',source.slice(start,at));continue;
    }
    number.lastIndex=at;const numeric=number.exec(source);
    if(numeric){at=number.lastIndex;token('number',numeric[0]);continue;}
    identifier.lastIndex=at;const name=identifier.exec(source);
    if(name){at=identifier.lastIndex;token(KEYWORDS.has(name[0])?'keyword':BUILTINS.has(name[0])?'builtin':/^\s*\(/.test(source.slice(at))?'call':null,name[0]);continue;}
    at++;token(null,c);
  }
  return output.join('');
}

function attachHighlight(editor){
  if(editor.closest('.python-editor'))return;
  const doc=editor.ownerDocument,shell=doc.createElement('div'),viewport=doc.createElement('div'),layer=doc.createElement('pre');
  shell.className='python-editor';viewport.className='python-highlight-viewport';layer.className='python-highlight';
  viewport.setAttribute('aria-hidden','true');viewport.inert=true;
  editor.before(shell);shell.append(viewport,editor);viewport.append(layer);
  // No focusable mirror, no synthetic input, no assignment to editor.value.
  const scroll=()=>{layer.style.transform=`translate(${-editor.scrollLeft}px, ${-editor.scrollTop}px)`;};
  const geometry=()=>{viewport.style.width=editor.clientWidth+'px';viewport.style.height=editor.clientHeight+editor.clientTop+'px';scroll();};
  const refresh=()=>{
    try{layer.innerHTML=highlightPython(editor.value);shell.classList.add('has-highlight');geometry();}
    catch{shell.classList.remove('has-highlight');}
  };
  let composing=false;
  editor.addEventListener('input',e=>{if(!composing&&!e.isComposing)refresh();});
  editor.addEventListener('scroll',scroll,{passive:true});
  editor.addEventListener('compositionstart',()=>{composing=true;shell.classList.add('is-composing');});
  editor.addEventListener('compositionend',()=>{composing=false;shell.classList.remove('is-composing');refresh();});
  if(typeof ResizeObserver!=='undefined')new ResizeObserver(geometry).observe(editor);
  refresh();
}

// Conservative lexical scan, not a Python parser. Ambiguous continuations are
// left to native editing; nothing in pasted or existing code is reformatted.
function context(source){
  let quote='',triple=false,comment=false,depth=0,line='',escaped=false,uncertain=false;
  for(let i=0;i<source.length;i++){
    const c=source[i];
    if(comment){if(c==='\n'){comment=false;line='';}continue;}
    if(quote){
      if(escaped){escaped=false;continue;}
      if(c==='\\'){escaped=true;continue;}
      if(triple&&source.slice(i,i+3)===quote.repeat(3)){i+=2;quote='';triple=false;}
      else if(!triple&&c===quote)quote='';
      else if(!triple&&c==='\n'){quote='';line='';}
      continue;
    }
    if(c==='\n'){line='';continue;}
    if(c==='#'){comment=true;continue;}
    if(c==='"'||c==="'"){quote=c;triple=source.slice(i,i+3)===c.repeat(3);if(triple)i+=2;line+=' ';continue;}
    if('([{'.includes(c))depth++;
    if(')]}'.includes(c)){depth--;if(depth<0)uncertain=true;}
    line+=c;
  }
  return {quoted:!!quote,continuation:depth!==0||uncertain||line.trimEnd().endsWith('\\'),line:line.trim()};
}

// One replacement transaction and explicit selection. Offsets refer to UTF-16,
// as do textarea selections, so accented text and emoji outside indentation stay intact.
export function indentationEdit(value,start,end,key,shift=false,direction='none'){
  const beginning=start===0?0:value.lastIndexOf('\n',start-1)+1;
  if(key==='Enter'){
    const prefix=value.slice(0,start),ctx=context(prefix);
    if(ctx.quoted||ctx.continuation)return null;
    let indent=value.slice(beginning,start).match(/^[ \t]*/)[0];
    const opener=/^(?:(?:async\s+)?(?:def|for|with)\b|(?:if|elif|else|while|class|try|except|finally|match|case)\b)/;
    if(ctx.line.endsWith(':')&&opener.test(ctx.line))indent+=STEP;
    const text='\n'+indent;return {start,end,text,selectionStart:start+text.length,selectionEnd:start+text.length,direction:'none'};
  }
  if(key==='Backspace'){
    const prefix=value.slice(beginning,start);
    if(start!==end||!/^ +$/.test(prefix))return null;
    const count=(prefix.length-1)%4+1;
    return {start:start-count,end:start,text:'',selectionStart:start-count,selectionEnd:start-count,direction:'none'};
  }
  if(key!=='Tab')return null;
  if(!shift&&start===end)return {start,end,text:STEP,selectionStart:start+4,selectionEnd:start+4,direction:'none'};
  const last=end>start&&value[end-1]==='\n'?end-1:end;
  const finish=value.indexOf('\n',last),limit=finish<0?value.length:finish;
  const block=value.slice(beginning,limit),lines=block.split('\n');let offset=beginning;
  const edits=lines.map(line=>{const removed=shift?(line.startsWith('\t')?1:Math.min(4,line.match(/^ */)[0].length)):0;
    const edit={at:offset,removed,insert:shift?'':STEP};offset+=line.length+1;return edit;});
  if(edits.every(e=>!e.removed&&!e.insert))return null;
  const map=position=>{let delta=0;for(const e of edits){if(position<e.at)break;if(position<e.at+e.removed)return e.at+delta;delta+=e.insert.length-e.removed;}return position+delta;};
  return {start:beginning,end:limit,text:lines.map((line,i)=>edits[i].insert+line.slice(edits[i].removed)).join('\n'),selectionStart:map(start),selectionEnd:map(end),direction,preserveScroll:true};
}

export function attachPythonEditor(editor){
  attachHighlight(editor);
  let leaveOnTab=false;
  function apply(edit){
    if(!edit)return false;
    const selection=[editor.selectionStart,editor.selectionEnd,editor.selectionDirection],top=editor.scrollTop,left=editor.scrollLeft;
    editor.setSelectionRange(edit.start,edit.end);
    // Native insertion preserves Edge's undo/redo stack and emits the ordinary
    // input event already consumed by persistence and the pedagogical guide.
    let inserted=false;try{inserted=document.execCommand('insertText',false,edit.text);}catch{}
    if(!inserted){editor.setSelectionRange(...selection);return false;}
    editor.setSelectionRange(edit.selectionStart,edit.selectionEnd,edit.direction);
    if(edit.preserveScroll){editor.scrollTop=top;editor.scrollLeft=left;}
    return true;
  }
  const plan=(key,shift)=>indentationEdit(editor.value,editor.selectionStart,editor.selectionEnd,key,shift,editor.selectionDirection);
  editor.addEventListener('keydown',e=>{
    if(e.isComposing||e.keyCode===229||e.ctrlKey||e.altKey||e.metaKey)return;
    if(e.key==='Escape'){leaveOnTab=true;return;}
    if(e.key==='Tab'&&leaveOnTab){leaveOnTab=false;return;}
    leaveOnTab=false;
    if(!['Enter','Tab','Backspace'].includes(e.key))return;
    const edit=plan(e.key,e.shiftKey);
    if(apply(edit)||(e.key==='Tab'&&!edit))e.preventDefault();
  });
  editor.addEventListener('beforeinput',e=>{if(!e.isComposing&&e.inputType==='insertLineBreak'&&apply(plan('Enter',false)))e.preventDefault();});
  editor.addEventListener('blur',()=>leaveOnTab=false);
}
