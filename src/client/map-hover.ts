type HoverRow=[label:string,value:string];

/** Plain text DOM keeps source-supplied names out of HTML and matches the approved compact preview. */
export function mapHoverCard(title:string,rows:HoverRow[],period?:string){
 const card=document.createElement('section');card.className='map-hover-card';card.setAttribute('role','tooltip');
 const header=document.createElement('header');header.className='map-hover-header';
 const heading=document.createElement('strong');heading.className='map-hover-title';
 const icon=document.createElementNS('http://www.w3.org/2000/svg','svg');
 for(const [key,value]of Object.entries({viewBox:'0 0 24 24',width:'15',height:'15',fill:'none',stroke:'currentColor','stroke-width':'1.7','stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true'}))icon.setAttribute(key,value);
 // Lucide Layers, from the installed lucide-react 0.468 package (ISC license).
 for(const d of ['M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z','M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12','M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17']){const path=document.createElementNS(icon.namespaceURI,'path');path.setAttribute('d',d);icon.appendChild(path)}
 const name=document.createElement('span');name.textContent=title;heading.appendChild(icon);heading.appendChild(name);header.appendChild(heading);
 if(period&&/^\d{4}-(0[1-9]|1[0-2])$/.test(period)){const date=document.createElement('span');date.className='map-hover-period';date.textContent=new Intl.DateTimeFormat('id-ID',{month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(period+'-01T00:00:00Z'));header.appendChild(date)}
 const facts=document.createElement('dl');facts.className='map-hover-facts';for(const [label,value]of rows){const key=document.createElement('dt'),text=document.createElement('dd');key.textContent=label;text.textContent=value;facts.appendChild(key);facts.appendChild(text)}
 card.appendChild(header);card.appendChild(facts);return card;
}
