// This module is injected by the separate prototype Vite config, never the staging build.
const bar=document.createElement('aside');bar.className='prototype-studio';bar.setAttribute('aria-label','Studio prototipe lokal');
bar.innerHTML='<span class="prototype-studio-dot" aria-hidden="true"></span><strong>Prototipe lokal</strong><span class="prototype-studio-note">Data simulasi · tersimpan di komputer ini</span><label>Ruang <select aria-label="Kepadatan prototipe"><option value="comfortable">Nyaman</option><option value="compact">Ringkas</option></select></label><button type="button" aria-label="Sembunyikan studio prototipe">×</button>';
bar.querySelector('select')!.addEventListener('change',event=>{document.documentElement.dataset.prototypeDensity=(event.target as HTMLSelectElement).value});
bar.querySelector('button')!.addEventListener('click',()=>{
 const collapsed=bar.classList.toggle('prototype-studio-collapsed'),button=bar.querySelector('button')!;
 button.textContent=collapsed?'↗':'×';button.setAttribute('aria-label',collapsed?'Buka studio prototipe':'Ringkas studio prototipe');
});
document.body.appendChild(bar);
