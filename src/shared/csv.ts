export type Csv={headers:string[];rows:Array<{line:number;values:string[]}>};
export function parseCsv(text:string):Csv{
 text=text.replace(/^\uFEFF/,'');let quote=false,counts={',':0,';':0,'\t':0};
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quote&&text[i+1]==='"'){i++;continue}quote=!quote}else if(!quote){if(c==='\r'||c==='\n')break;if(c in counts)counts[c as keyof typeof counts]++}}
 const delimiter=Object.entries(counts).sort((a,b)=>b[1]-a[1])[0][0];
 const parsed:Array<{line:number;values:string[]}>=[];let cell='',cells:string[]=[],inside=false,closed=false,line=1,start=1;
 function endCell(){cells.push(cell);cell='';closed=false}
 function endRow(){endCell();if(cells.some(x=>x.trim()!==''))parsed.push({line:start,values:cells});cells=[];start=line+1;if(parsed.length>201)throw new Error('Maksimum 200 baris data per file. Pecah file sebelum diunggah.')}
 for(let i=0;i<text.length;i++){const c=text[i];if(inside){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++}else{inside=false;closed=true}}else{cell+=c;if(c==='\n'||(c==='\r'&&text[i+1]!=='\n'))line++}continue}
  if(c==='"'){if(cell!==''||closed)throw new Error('Tanda kutip CSV tidak valid pada baris '+line);inside=true}
  else if(c===delimiter)endCell();else if(c==='\r'||c==='\n'){endRow();if(c==='\r'&&text[i+1]==='\n')i++;line++;start=line}
  else{if(closed)throw new Error('Karakter setelah tanda kutip pada baris '+line);cell+=c}
 }
 if(inside)throw new Error('Tanda kutip CSV belum ditutup.');if(cell!==''||cells.length||closed)endRow();
 const head=parsed.shift();if(!head)throw new Error('CSV kosong.');const headers=head.values.map(x=>x.trim());
 if(headers.length>40||headers.some(x=>!x||x.length>120)||new Set(headers).size!==headers.length)throw new Error('Header harus unik, terisi, maksimum 40 kolom.');
 if(!parsed.length)throw new Error('CSV tidak memiliki baris data.');return {headers,rows:parsed};
}
export function csvCell(value:unknown){let text=String(value??'');if(/^[\s]*[=+@-]/.test(text)||/^[\t\r]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"'}
export function csvFile(rows:unknown[][]){return '\uFEFF'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n')+'\r\n'}
