import {legacyAnnotations} from './python-annotations.js';
// Small, explicit editorial notation. No HTML, link or inferred identifier parsing.
export function proseParts(value=''){
 const parts=[],pattern=/```(?:python|text)?\r?\n([\s\S]*?)\r?\n```|`([^`\r\n]+)`/g;let at=0;
 for(const match of String(value).matchAll(pattern)){if(match.index>at)parts.push({type:'text',value:value.slice(at,match.index)});parts.push({type:match[1]===undefined?'code':'block',value:match[1]??match[2]});at=match.index+match[0].length;}
 if(at<value.length)parts.push({type:'text',value:value.slice(at)});return parts;
}
export const plainProse=value=>proseParts(String(value??'')).map(p=>p.value).join('');
export function renderProse(element,value=''){
 const doc=element.ownerDocument,fragment=doc.createDocumentFragment();for(const part of proseParts(legacyAnnotations.get(String(value))??String(value))){if(part.type==='text')fragment.append(doc.createTextNode(part.value));else{const code=doc.createElement('code');code.textContent=part.value;code.className='python-fragment';if(part.type==='block'){const pre=doc.createElement('pre');pre.className='python-block';pre.append(code);fragment.append(pre);}else fragment.append(code);}}element.replaceChildren(fragment);
}
// These exact labels belong to the existing analyzer; no diagnosis is inferred.
const labels={'boucle for':'boucle `for`','boucle while':'boucle `while`','instruction if':'instruction `if`','alternative if/else':'alternative `if`/`else`','lecture de obstacle_devant()':'lecture de `duck.obstacle_devant()`','négation not':'négation `not`','ajout avec append':'ajout avec `append`','déclaration global':'instruction `global`','appel de la méthode .index()':'appel de la méthode `.index()`'};
export function diagnosticProse(reason,{verbatim=false}={}){for(const[from,to]of Object.entries(labels))if(reason.startsWith(from+' :')){const label=verbatim&&from==='lecture de obstacle_devant()'?'lecture de `obstacle_devant()`':verbatim&&from==='déclaration global'?'déclaration `global`':to;return label+reason.slice(from.length);}return reason;}
export function unmarkedPython(value){const findings=[];for(const p of proseParts(value))if(p.type==='text')for(const m of p.value.matchAll(/\b(?:duck\.[a-z_]+|[a-z_]+)\([^\n)]*\)|\b(?:for|while|if|elif|else|return|assert|global|True|False|None|range|print)\b|(?<!\w)-1(?!\w)/g))findings.push(m[0]);return findings;}
