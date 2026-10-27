import { parseArchive, imagePixels, fontPixels } from './assets.js';
import { SOUND_COUNT, renderSound, soundOffset, wavFile } from './audio.js';
import { renderTandyPreview } from './tandy-preview.js';
import { attachTandyLiveControls } from './tandy-live.js';
const $ = id => document.getElementById(id);
let assets = [], selected, timer, audioUrl, exportData, exportName, generation = 0, tandyAudioUrl, tandyLiveCleanup;
const decodeText = bytes => new TextDecoder('windows-1252').decode(bytes).replace(/\x1a/g, '');
const hex = data => Array.from({length: Math.ceil(Math.min(4096, data.length) / 16)}, (_, i) => `${(i * 16).toString(16).padStart(6,'0')}  ${Array.from(data.slice(i*16,i*16+16), n => n.toString(16).padStart(2,'0')).join(' ')}`).join('\n') + (data.length > 4096 ? '\n… first 4096 bytes shown' : '');
for (let i = 0; i < 16; i++) $('transparent').add(new Option(String(i), String(i)));
function stopMedia() {
  tandyLiveCleanup?.(); tandyLiveCleanup=null;
  clearInterval(timer); timer = null; $('animate').textContent = 'Play animation';
  document.querySelectorAll('audio').forEach(audio=>audio.pause());
  if (tandyAudioUrl) { URL.revokeObjectURL(tandyAudioUrl); tandyAudioUrl = null; }
  if (audioUrl) { URL.revokeObjectURL(audioUrl); audioUrl = null; }
}
function appendTandyPreview(entry) {
  const section=document.createElement('section');section.className='audio-panel';section.setAttribute('aria-label','Tandy preview');
  const label=document.createElement('h3');label.textContent='Tandy preview';section.append(label);
  const diagnostic=document.createElement('p');diagnostic.setAttribute('role','alert');diagnostic.hidden=true;
  const fail=error=>{section.dataset.state='error';diagnostic.hidden=false;diagnostic.textContent=`Tandy preview stopped: ${error.message}`;};
  try {
    const tandy=renderTandyPreview(entry.tandyDriver,entry.index);
    section.dataset.ticks=String(tandy.ticks);
    if(tandy.pcm.length===0){
      section.dataset.state='silent';const silence=document.createElement('p');silence.textContent='This original request ends without audio samples.';section.append(silence);
    } else {
      tandyAudioUrl=URL.createObjectURL(new Blob([wavFile(tandy)],{type:'audio/wav'}));
      const player=document.createElement('audio');player.controls=true;player.src=tandyAudioUrl;player.volume=0.5;
      player.setAttribute('aria-label','Tandy sound preview');player.dataset.state=section.dataset.state='ready';player.dataset.ticks=String(tandy.ticks);
      const play=document.createElement('button');play.textContent='Play Tandy preview';
      player.onplay=()=>{player.dataset.state=section.dataset.state='playing';document.querySelectorAll('audio').forEach(other=>{if(other!==player)other.pause();});};
      player.onended=()=>{player.dataset.state=section.dataset.state='ended';};
      player.onerror=()=>{player.dataset.state='error';fail(new Error(player.error?.message||'Native audio decoding failed'));};
      play.onclick=()=>{player.currentTime=0;player.play().catch(error=>{player.dataset.state='error';fail(error);});};
      const caption=document.createElement('p');caption.textContent=`${tandy.duration.toFixed(2)} seconds · ${tandy.sampleRate.toLocaleString()} Hz · Sequence complete`;
      section.append(play,player,caption);
    }
  } catch(error){
    if(error.code==="TANDY_PREVIEW_LIMIT")tandyLiveCleanup=attachTandyLiveControls(section,entry.tandyDriver,entry.index,fail);
    else fail(error);
  }
  const limit=document.createElement('p');limit.textContent='Tandy asset playback with live controls for long sequences. Unsupported paths stop with a diagnostic. Waveform matching remains unverified; the game still uses PC-speaker audio.';
  section.append(diagnostic,limit);$('stage').append(section);
}
function draw() {
  const entry = selected, canvas = $('stage').querySelector('canvas');
  if (!canvas || !entry) return;
  const font = entry.kind === 'Font';
  canvas.width = font ? 128 : entry.width; canvas.height = font ? 128 : entry.height;
  canvas.getContext('2d').putImageData(new ImageData(font ? fontPixels(entry.data) : imagePixels(entry, +$('frame').value, +$('transparent').value), canvas.width, canvas.height), 0, 0);
  canvas.style.width = `${canvas.width * +$('zoom').value}px`; canvas.style.height = `${canvas.height * +$('zoom').value}px`;
  $('frame-label').value = `${+$('frame').value + 1} / ${entry.frames}`;
}
function select(entry) {
  stopMedia(); selected = entry; exportData = entry.data; exportName = `${entry.archive}-${entry.index}.bin`;
  $('title').textContent = entry.name; $('category').textContent = entry.kind;
  $('stage').replaceChildren(); $('controls').hidden = true; $('download').disabled = false;
  $('note').textContent = ''; $('hex').textContent = hex(entry.data);
  $('metadata').replaceChildren();
  const meta = entry.kind === 'Sound' ? [`Sound ID ${entry.index}`, 'PC speaker', `Driver offset 0x${entry.offset.toString(16)}`] : [`${entry.data.length.toLocaleString()} decoded bytes`, ...(entry.offset !== undefined ? [`Offset 0x${entry.offset.toString(16)}`, `${entry.packedSize} packed bytes`] : []), ...(entry.type < 4 ? [`${entry.width} × ${entry.height}`, `${entry.frames} frame${entry.frames === 1 ? '' : 's'}`] : [])];
  for (const text of meta) { const badge = document.createElement('span'); badge.textContent = text; $('metadata').append(badge); }
  $('hex').textContent = (entry.words ? `Type: ${entry.type}\nHeader words +10,+12,+14: ${entry.words.map(n => '0x'+n.toString(16).padStart(4,'0')).join(', ')}\n\n` : '') + hex(entry.data);
  if (entry.type < 4 || entry.kind === 'Font') {
    $('stage').append(document.createElement('canvas')); $('controls').hidden = false;
    $('frame').max = entry.frames - 1; $('frame').value = 0; $('frame').disabled = entry.frames <= 1;
    $('animate').disabled = entry.frames <= 1; $('transparent').disabled = entry.kind === 'Font';
    $('transparent').value = '-1'; draw();
    $('note').textContent = entry.kind === 'Font' ? '256 original 8×8 glyphs, arranged by character code. Export saves the atlas as PNG.' : 'Original 16-color pixels. Transparency and animation speed are preview settings; game-specific masking and timing are not inferred.';
  } else if (entry.kind === 'Sound') {
    try {
      const result = renderSound(entry.driver, entry.index); exportData = wavFile(result); exportName = `sound-${entry.index}.wav`;
      audioUrl = URL.createObjectURL(new Blob([exportData], {type:'audio/wav'}));
      const panel = document.createElement('div'); panel.className = 'audio-panel';
      const title = document.createElement('h3'); title.textContent = `Sound ${String(entry.index).padStart(3, '0')}`;
      const canvas = document.createElement('canvas'); canvas.width = 600; canvas.height = 100;
      const ctx = canvas.getContext('2d'); ctx.strokeStyle = '#eac878'; ctx.beginPath();
      for (let x = 0; x < 600; x++) { const begin = Math.floor(x * result.pcm.length / 600), end = Math.floor((x+1)*result.pcm.length/600); let peak = 0; for (let i = begin; i < end; i++) peak = Math.max(peak,Math.abs(result.pcm[i])); ctx.moveTo(x,50-peak*220); ctx.lineTo(x,50+peak*220); } ctx.stroke();
      const audio = document.createElement('audio'); audio.controls = true; audio.src = audioUrl; audio.volume = 0.5;
      const caption = document.createElement('p'); caption.textContent = `${result.duration.toFixed(2)} seconds · ${result.sampleRate.toLocaleString()} Hz · ${result.truncated ? 'Preview capped at 60 seconds (looping / long sequence)' : 'Sequence complete'}`;
      panel.append(title,canvas,audio,caption); $('stage').append(panel);
      audio.addEventListener('play',()=>document.querySelectorAll('audio').forEach(other=>{if(other!==audio)other.pause();}));
      if (entry.tandyDriver) appendTandyPreview(entry);
      $('note').textContent = `Reconstructed PC-speaker playback from IT.DRV #005. ${result.approximate ? 'Noise and engine effects are approximate; engine speed is fixed for audition.' : 'Pitch, rests, tempo, loops and modulation are interpreted from the driver.'} Tandy audition uses the translated paths in resource #004 and stops on unsupported commands or devices. Some IDs intentionally contain silence or alias another sequence.`;
    } catch (error) { $('stage').textContent = `Unable to render audio: ${error.message}`; $('download').disabled = true; }
  } else {
    const pre = document.createElement('pre'); pre.textContent = entry.kind === 'Text / data' || entry.kind === 'Document' ? decodeText(entry.data) : hex(entry.data); $('stage').append(pre);
    if (entry.kind === 'Text / data' || entry.kind === 'Document') exportName = `${entry.archive}-${entry.index}.txt`;
    $('note').textContent = entry.kind === 'Driver' ? 'Decoded DOS driver machine code. Sound resources are listed separately under Sound.' : entry.kind === 'Binary' ? 'Original binary file. Shown as hexadecimal; executable code is not run.' : 'Original text, including game data and DOS line endings. DOS end-of-file markers are hidden in this preview.';
  }
  for (const button of $('list').children) button.setAttribute('aria-current', String(button.dataset.key === entry.key));
}
function filter() {
  const query = $('search').value.toLowerCase();
  const matches = assets.filter(e => (!$('archive').value || e.archive === $('archive').value) && (!$('kind').value || e.kind === $('kind').value) && (!query || `${e.name} ${e.kind} ${e.kind === 'Text / data' ? decodeText(e.data) : ''}`.toLowerCase().includes(query)));
  $('count').textContent = matches.length; $('list').replaceChildren();
  for (const entry of matches) {
    const button = document.createElement('button'); button.dataset.key = entry.key; button.textContent = entry.name;
    const small = document.createElement('small'); small.textContent = `${entry.kind}${entry.type < 4 ? ` · ${entry.width}×${entry.height} · ${entry.frames}f` : ''}`; button.append(small);
    button.setAttribute('aria-current', String(selected?.key === entry.key)); button.onclick = () => select(entry); $('list').append(button);
  }
}
async function load(files) {
  const current = ++generation; stopMedia(); $('status').textContent = 'Opening the vault…';
  const next = [], errors = [];
  for (const file of files) {
    if (file.name.startsWith('.')) continue;
    try {
      const data = new Uint8Array(await file.arrayBuffer());
      if (/\.(arc|drv)$/i.test(file.name)) {
        const entries = parseArchive(data, file.name); next.push(...entries);
        if (file.name.toUpperCase() === 'IT.DRV') {
          const driver = entries[5]?.data;
          for (let id = 0; id < SOUND_COUNT; id++) {
            const offset = soundOffset(driver, id);
            next.push({ name: `IT.DRV · Sound ${String(id).padStart(3,'0')}`, archive: file.name, index:id, offset, kind:'Sound', driver, tandyDriver:entries[4]?.data, data:driver.subarray(offset, Math.min(offset+128,driver.length)) });
          }
        }
      } else next.push({name:file.name, archive:file.name, index:0, data, kind:/\.(doc|bat|ba1|txt)$/i.test(file.name) ? 'Document' : 'Binary'});
    } catch (error) { errors.push(`${file.name}: ${error.message}`); }
  }
  if (current !== generation) return;
  assets = next.map((e,i) => ({...e,key:String(i)})); selected = null;
  for (const [id, values, label] of [['archive',new Set(assets.map(e=>e.archive)),'All files'],['kind',new Set(assets.map(e=>e.kind)),'All types']]) {
    $(id).replaceChildren(new Option(label,'')); for (const value of [...values].sort()) $(id).add(new Option(value,value));
  }
  $('search').value = ''; $('total').textContent = assets.length; filter();
  $('status').textContent = `${files.length} files opened · ${assets.length} entries${errors.length ? `\n${errors.length} files could not be decoded:\n${errors.join('\n')}` : ' · All resources decoded successfully'}`;
  if (assets.length) select(assets.find(e=>e.archive.toUpperCase()==='MAIN.ARC' && e.index===2) || assets[0]);
  else { $('stage').textContent = 'No supported assets loaded. Select the original game folder.'; $('title').textContent = 'No assets loaded'; $('metadata').replaceChildren(); $('controls').hidden = true; $('download').disabled = true; $('hex').textContent = ''; $('note').textContent = ''; }
}
async function loadLocal() {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}__local_assets`);
    if (!response.ok) throw Error('No local folder');
    const names = await response.json();
    const files = await Promise.all(names.map(async name => { const res = await fetch(`${import.meta.env.BASE_URL}game/${encodeURIComponent(name)}`); if (!res.ok) throw Error(`Cannot read ${name}`); return new File([await res.arrayBuffer()], name); }));
    await load(files);
  } catch { $('status').textContent = 'Choose “Open game folder” to load your original files. Automatic game/ loading is available in the Vite development server.'; }
}
$('local').onclick = loadLocal;
$('choose-folder').onclick = () => $('folder').click();
$('choose-files').onclick = () => $('files').click();
for (const id of ['folder','files']) $(id).onchange = event => load([...event.target.files]);
for (const id of ['search','archive','kind']) $(id).addEventListener('input',filter);
$('frame').oninput = draw; $('zoom').onchange = draw; $('transparent').onchange = draw;
$('animate').onclick = () => {
  if (timer) { clearInterval(timer); timer=null; $('animate').textContent='Play animation'; return; }
  $('animate').textContent='Pause animation'; let last = performance.now();
  timer = setInterval(() => { const now=performance.now(); if(now-last >= 1000/+$('fps').value) { $('frame').value = (+$('frame').value+1)%selected.frames; draw(); last=now; } }, 16);
};
$('download').onclick = () => {
  const canvas = selected?.kind !== 'Sound' && $('stage').querySelector('canvas');
  const save = (blob,name) => { const url=URL.createObjectURL(blob), a=document.createElement('a'); a.href=url; a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000); };
  if(canvas) canvas.toBlob(blob=>save(blob,`${selected.archive}-${selected.index}-frame-${$('frame').value}.png`));
  else save(new Blob([exportData]),exportName);
};
window.addEventListener('pagehide',stopMedia);
if (import.meta.env.DEV) loadLocal(); else $('local').hidden = true;
