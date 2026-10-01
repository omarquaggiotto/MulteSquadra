window.TEAM_FIXTURES={teamId:0,updatedAt:"",season:"",competition:"",source:"",teams:[],matches:[],played:[],venues:{}};
(function () {
 let data = window.TEAM_FIXTURES;
 const zone = 'Europe/Rome';
 function ownTeamId() { return Number(data.teamId) || 0; }
 function kickoff(match) {
   const parts = (match.date + 'T' + match.time).split(/[-T:]/).map(Number);
   const wall = Date.UTC(parts[0], parts[1]-1, parts[2], parts[3], parts[4]);
   let stamp = wall;
   for (let i=0;i<2;i++) {
     const formatted = new Intl.DateTimeFormat('en-GB',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(stamp);
     const p = Object.fromEntries(formatted.map(x=>[x.type,x.value]));
     const asUTC = Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute,+p.second);
     stamp = wall - (asUTC-stamp);
   }
   return stamp;
 }
 function select(now=Date.now()) {
   return data.matches.filter(m=>m.status==='scheduled' && Number.isFinite(kickoff(m)) && now < kickoff(m)).sort((a,b)=>kickoff(a)-kickoff(b))[0] || null;
 }
 function escape(value) { return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
 function fastLogo(value) { return String(value||'').replace('/Teams/Original/','/Teams/80/'); }
 function team(id) {
   const t=data.teams.find(t=>t.id===id);
   const isOwn=id===ownTeamId();
   const fullName=t.name;
   const parts=fullName.match(/^(.*?)\s+Sq\. B$/i);
   const name=parts?parts[1]:fullName;
   const qualifier=parts?'Sq. B':'';
   const fallback=!isOwn&&t.fallbackLogo?` data-fallback="${escape(t.fallbackLogo)}" onerror="this.onerror=null;this.src=this.dataset.fallback"`:'';
   return `<div class="next-match-team ${isOwn?'is-gs-team':'is-opponent-team'}"><span class="next-match-crest"><img src="${escape(fastLogo(t.logo))}"${fallback} alt="Stemma ${escape(t.name)}"></span><strong class="${qualifier?'has-qualifier':'no-qualifier'}"><span class="next-match-name">${escape(name)}</span><span class="next-match-qualifier"${qualifier?'':' aria-hidden="true"'}>${qualifier||'&nbsp;'}</span></strong></div>`;
 }
 function directions(m) {
   if(m.awayId!==ownTeamId()) return '';
   const venue=m.venue || (data.venues || {})[m.homeId];
   const home=data.teams.find(t=>Number(t.id)===Number(m.homeId));
   const destination=venue?.address
     ? `${venue.name||'Campo sportivo'}, ${venue.address}, Italia`
     : `${m.place&&m.place!=='Campo da definire'?m.place:`Campo sportivo ${home?.name||''}`}, Italia`;
   const url='https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(destination);
   const title=venue?.name||`Campo di ${home?.name||'gara'}`;
   const detail=venue?.address||m.place||'Ricerca automatica del campo su Maps';
   return `<div class="match-venue"><div><strong>${escape(title)}</strong><span>${escape(detail)}</span></div><a class="match-maps" href="${escape(url)}" target="_blank" rel="noopener noreferrer" aria-label="Apri in Maps: ${escape(destination)}"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m21 3-7 18-4-7-7-4Z"/><path d="m10 14 11-11"/></svg>Apri in Maps</a></div>`;
 }
 function contents(now=Date.now()) {
   const m=select(now);
   if(!m) {
     const played=data.matches.map(match=>kickoff(match)).filter(Number.isFinite);
     const seasonEnded=played.length>0 && now>Math.max(...played);
     return `<div class="next-match-top"><span><i></i>${seasonEnded?'STAGIONE CONCLUSA':'NEXT MATCH'}</span></div><div class="next-match-empty"><strong>${seasonEnded?'Stagione conclusa':'Nessuna partita in programma'}</strong><p>${seasonEnded?'Il calendario non prevede altre partite.':'Non risultano altre gare nei calendari disponibili.'}</p></div><div class="next-match-bottom"><span>Consulta la stagione</span><div class="next-match-links"><button type="button" data-open-team-standings aria-label="Visualizza classifica" title="Classifica"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20V10h4v10M10 20V4h4v16M16 20v-7h4v7M3 20h18"/></svg></button><button type="button" data-open-team-calendar aria-label="Visualizza calendario partite" title="Calendario"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01"/></svg></button><a href="${data.source}" target="_blank" rel="noopener noreferrer">Tuttocampo ↗</a></div></div>`;
   }
   const date=new Intl.DateTimeFormat('it-IT',{timeZone:zone,weekday:'short',day:'numeric',month:'short'}).format(kickoff(m));
   return `<div class="next-match-top"><span><i></i>${now>=kickoff(m)?'MATCH DAY':'NEXT MATCH'}</span><span class="next-match-demo">${m.round}ª GIORNATA</span></div><div class="next-match-teams">${team(m.homeId)}<div class="next-match-time"><span>${escape(date)}</span><strong>${escape(m.time)}</strong><small>Ora italiana</small></div>${team(m.awayId)}</div><div class="next-match-bottom"><span>${m.homeId===ownTeamId()?'In casa':'In trasferta'} · ${escape(m.place||'campo da definire')}</span><div class="next-match-links"><button type="button" data-open-team-standings aria-label="Visualizza classifica" title="Classifica"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20V10h4v10M10 20V4h4v16M16 20v-7h4v7M3 20h18"/></svg></button><button type="button" data-open-team-calendar aria-label="Visualizza calendario partite" title="Calendario"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01"/></svg></button><a href="${escape(m.url)}" target="_blank" rel="noopener noreferrer">Tuttocampo ↗</a></div></div>${directions(m)}`;
 }
 function setData(nextData) {
   if (!nextData || !Array.isArray(nextData.matches) || !Array.isArray(nextData.teams)) return false;
   data=nextData;
   refresh();
   return true;
 }
 function setTeamLogo(src) {
   const own=data.teams.find(t=>t.id===ownTeamId());
   if(own && src) own.logo=src;
   refresh();
 }
 window.MatchCalendar={kickoff,select,contents,directions,setData,setTeamLogo,getData:()=>data};
 window.renderNextMatch=()=>`<section id="nextMatchBanner" class="next-match" aria-label="Prossima partita">${contents()}</section>`;
 function refresh(){const banner=document.getElementById('nextMatchBanner');if(banner)banner.innerHTML=contents();}
 setInterval(refresh,60000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
 window.addEventListener('pageshow',refresh);
 document.addEventListener('click',event=>{if(event.target.closest('[data-open-team-calendar]'))window.openTeamCalendar?.();if(event.target.closest('[data-open-team-standings]'))window.openTeamStandings?.();});
})();

