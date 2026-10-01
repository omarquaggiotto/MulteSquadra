const DEMO_ACTIVATION_CODE="PROVA-SQUADRA-2026",LOCAL=/^(?:localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(?:1[6-9]|2\d|3[01])\.\d+\.\d+)$/.test(location.hostname),runtime=window.__MULTE_CONFIG__||{},supabaseClient=!LOCAL&&runtime.supabaseUrl&&runtime.supabaseAnonKey&&window.supabase?.createClient?window.supabase.createClient(runtime.supabaseUrl,runtime.supabaseAnonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}):null,loginPanel=document.getElementById("loginPanel"),teamPanel=document.getElementById("teamPanel"),rosterPanel=document.getElementById("rosterPanel"),configPanel=document.getElementById("configPanel"),successPanel=document.getElementById("successPanel"),statusBox=document.getElementById("status"),preview=document.getElementById("preview"),confirmButton=document.getElementById("confirmTeam");
let stagedProfile=null,adminUsername="",adminPassword="",rosterMembers=[],selectedRoster=[],activeAppTeamId="";
const show=panel=>[loginPanel,teamPanel,rosterPanel,configPanel,successPanel].forEach(item=>item.classList.toggle("hidden",item!==panel));
const escapeHtml=value=>String(value||"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[char]);
const normalizeUsername=value=>String(value||"").trim().toLowerCase();
const usernameEmail=value=>`${normalizeUsername(value)}@login.multesquadra.app`;
const directoryTeamUrl=team=>{
  if(team?.teamUrl)return team.teamUrl;
  const league=String(team?.league||"").split("·").map(value=>value.trim()).filter(Boolean);
  const slug=String(team?.name||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/gi,"");
  return team?.region&&league.length>=2&&slug&&team?.teamId?`https://www.tuttocampo.it/${encodeURIComponent(team.region)}/${encodeURIComponent(league[0])}/${encodeURIComponent(league[1])}/Squadra/${slug}/${Number(team.teamId)}/Scheda`:"";
};

async function loadProfile(teamId){
  stagedProfile=null; preview.classList.add("hidden"); confirmButton.classList.add("hidden"); statusBox.className="status"; statusBox.textContent="Sto cercando la squadra e verificando lo stemma…";
  try{
    let payload;
    if(LOCAL){const response=await fetch(`/__team-profile?teamId=${encodeURIComponent(teamId)}`,{cache:"no-store"});payload=await response.json();if(!response.ok)throw new Error(payload.error||"Squadra non trovata");}
    else{if(!supabaseClient||!activeAppTeamId)throw new Error("Attivazione non completata");const {data,error}=await supabaseClient.functions.invoke("import-tuttocampo-calendar",{body:{mode:"profile",teamId:Number(teamId),appTeamId:activeAppTeamId}});if(error)throw new Error(error.message||"Squadra non trovata");payload=data;}
    if(!payload.profile) throw new Error(payload.error||"Squadra non trovata");
    stagedProfile=payload.profile;
    if(/^\d+$/.test(String(stagedProfile.name||""))){
      const directory=await fetch("data/team-directory.json",{cache:"no-store"}).then(response=>response.ok?response.json():[]).catch(()=>[]),known=directory.find(team=>Number(team.teamId)===Number(teamId));
      if(known){const teamUrl=directoryTeamUrl(known)||stagedProfile.teamUrl,slug=String(teamUrl||"").match(/\/Squadra\/([^/]+)\//i)?.[1]||stagedProfile.slug;stagedProfile={...stagedProfile,name:known.name,league:known.league||stagedProfile.league,logo:known.logo||stagedProfile.logo,slug,teamUrl};stagedProfile.calendarUrl=teamUrl.replace(/\/Scheda\/?$/i,"/Calendario");}
    }
    document.getElementById("teamCode").value=String(stagedProfile.teamId); document.getElementById("teamLogo").src=stagedProfile.logo; document.getElementById("teamName").textContent=stagedProfile.name; document.getElementById("teamLeague").textContent=stagedProfile.league; statusBox.textContent="Controlla nome e stemma prima di creare il profilo."; preview.classList.remove("hidden"); confirmButton.classList.remove("hidden");
  }catch(error){statusBox.className="status error";statusBox.textContent=error instanceof Error?error.message:"Ricerca non riuscita";}
}

async function recoverExistingTeam(userId){
  const {data,error}=await supabaseClient.from("team_memberships").select("team_id,role").eq("user_id",userId).limit(1).maybeSingle();
  if(error)throw error;
  if(!data?.team_id)return false;
  activeAppTeamId=String(data.team_id);
  localStorage.setItem("multesquadra_active_team_v1",activeAppTeamId);
  show(teamPanel);
  return true;
}

document.getElementById("loginForm").addEventListener("submit",async event=>{
  event.preventDefault();
  adminUsername=normalizeUsername(document.getElementById("username").value);
  const email=usernameEmail(adminUsername),code=document.getElementById("activationCode").value.trim().toUpperCase(),passwordConfirm=document.getElementById("passwordConfirm").value;
  adminPassword=document.getElementById("password").value;
  if(!/^[a-z0-9._-]{3,32}$/.test(adminUsername))return alert("Il nome utente deve avere da 3 a 32 caratteri e può contenere lettere, numeri, punto, trattino e trattino basso.");
  if(adminPassword.length<8)return alert("La password Admin deve contenere almeno 8 caratteri.");
  if(adminPassword!==passwordConfirm)return alert("Le password non coincidono. Controllale e riprova.");
  if(LOCAL){if(code!==DEMO_ACTIVATION_CODE)return alert("Codice di attivazione non valido per questa prova locale.");show(teamPanel);return;}
  if(!supabaseClient)return alert("Servizio di attivazione non configurato.");
  const button=event.currentTarget.querySelector("button");button.disabled=true;button.textContent="Attivazione…";
  try{
    let user=null;
    const signed=await supabaseClient.auth.signInWithPassword({email,password:adminPassword});
    if(!signed.error){
      user=signed.data.user;
      if(user&&await recoverExistingTeam(user.id))return;
    }else{
      const created=await supabaseClient.auth.signUp({email,password:adminPassword,options:{data:{username:adminUsername}}});
      if(created.error){
        if(/already|registered|invalid login/i.test(created.error.message||""))throw new Error("Nome utente già esistente: controlla la password oppure accedi dall’app.");
        throw created.error;
      }
      user=created.data.user;
      if(!created.data.session){const retry=await supabaseClient.auth.signInWithPassword({email,password:adminPassword});if(retry.error)throw new Error("Accesso non completato. Riprova tra qualche secondo.");user=retry.data.user;}
    }
    if(user&&await recoverExistingTeam(user.id))return;
    const redeemed=await supabaseClient.rpc("redeem_activation_code",{p_code:code});
    if(redeemed.error)throw new Error(redeemed.error.message||"Codice non valido o già usato");
    activeAppTeamId=String(redeemed.data||"");
    if(!activeAppTeamId)throw new Error("Attivazione non completata");
    localStorage.setItem("multesquadra_active_team_v1",activeAppTeamId);
    show(teamPanel);
  }catch(error){alert(error.message||"Attivazione non riuscita");}
  finally{button.disabled=false;button.textContent="Attiva e continua";}
});
document.getElementById("teamSearchForm").addEventListener("submit",async event=>{
  event.preventDefault(); const query=document.getElementById("teamSearch").value.trim(),box=document.getElementById("searchResults"); box.innerHTML='<div class="empty-result">Ricerca nel catalogo…</div>';
  try{const teams=await searchCatalog(query);if(!teams.length){box.innerHTML='<div class="empty-result">Squadra non ancora presente. Inserisci il codice qui sotto.</div>';return;}box.innerHTML=teams.map(team=>`<button class="search-result" type="button" data-team-id="${Number(team.teamId)}"><img src="${escapeHtml(team.logo)}" alt=""><span><strong>${escapeHtml(team.name)}</strong><small>${escapeHtml(team.league||"Tuttocampo")}</small></span><b>›</b></button>`).join("");box.querySelectorAll("[data-team-id]").forEach(button=>button.addEventListener("click",()=>loadProfile(button.dataset.teamId)));}catch(error){box.innerHTML=`<div class="empty-result">${escapeHtml(error instanceof Error?error.message:"Ricerca non riuscita")}</div>`;}
});
let catalogCache=null;async function catalog(){if(catalogCache)return catalogCache;const response=await fetch("data/team-directory.json",{cache:"no-store"});if(!response.ok)throw new Error("Catalogo non disponibile");return catalogCache=await response.json();}async function searchCatalog(query=""){const normalized=value=>String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();const terms=normalized(query).split(/\s+/).filter(Boolean);return(await catalog()).filter(team=>terms.every(term=>normalized(`${team.name} ${team.league||""}`).includes(term))).slice(0,12);}
document.getElementById("browseAllTeams").addEventListener("click",async()=>{
  const box=document.getElementById("searchResults");box.classList.add("is-catalog");box.innerHTML='<div class="empty-result">Carico il catalogo Veneto…</div>';
  try{const teams=await catalog();box.innerHTML=`<div class="catalog-count">${teams.length} squadre disponibili</div>`+teams.map(team=>`<button class="search-result" type="button" data-team-id="${Number(team.teamId)}"><img loading="lazy" src="${escapeHtml(team.logo)}" alt=""><span><strong>${escapeHtml(team.name)}</strong><small>${escapeHtml(team.league||"Tuttocampo")}</small></span><b>›</b></button>`).join("");box.querySelectorAll("[data-team-id]").forEach(button=>button.addEventListener("click",()=>loadProfile(button.dataset.teamId)));}catch(error){box.innerHTML=`<div class="empty-result">${escapeHtml(error instanceof Error?error.message:"Catalogo non disponibile")}</div>`;}
});
document.getElementById("teamForm").addEventListener("submit",event=>{event.preventDefault();loadProfile(document.getElementById("teamCode").value.trim());});
async function passwordHash(value){const bytes=new TextEncoder().encode(value);const digest=await crypto.subtle.digest("SHA-256",bytes);return [...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,"0")).join("");}
function rgbHex(r,g,b){return `#${[r,g,b].map(value=>Math.max(0,Math.min(255,Math.round(value))).toString(16).padStart(2,"0")).join("")}`;}
function darken(hex){const value=hex.replace("#","");return rgbHex(parseInt(value.slice(0,2),16)*.72,parseInt(value.slice(2,4),16)*.72,parseInt(value.slice(4,6),16)*.72);}
async function logoColors(){try{const response=await fetch(LOCAL?`/__team-logo?url=${encodeURIComponent(stagedProfile.logo)}`:stagedProfile.logo,{cache:"no-store"});const blob=await response.blob(),bitmap=await createImageBitmap(blob),canvas=document.createElement("canvas");canvas.width=80;canvas.height=80;const context=canvas.getContext("2d",{willReadFrequently:true});context.drawImage(bitmap,0,0,80,80);bitmap.close?.();const data=context.getImageData(0,0,80,80).data,buckets=new Map();for(let i=0;i<data.length;i+=16){const a=data[i+3],raw=[data[i],data[i+1],data[i+2]],max=Math.max(...raw),min=Math.min(...raw);if(a<180||max-min<30||raw.reduce((sum,value)=>sum+value,0)>700||raw.reduce((sum,value)=>sum+value,0)<80)continue;const color=raw.map(value=>Math.round(value/32)*32),key=color.join(",");buckets.set(key,(buckets.get(key)||0)+1);}const colors=[...buckets.entries()].sort((a,b)=>b[1]-a[1]).map(([key])=>key.split(",").map(Number));if(!colors.length)return["#2563eb","#60a5fa"];const primary=colors[0],distance=color=>color.reduce((sum,value,index)=>sum+(value-primary[index])**2,0),accent=colors.slice(1).sort((a,b)=>distance(b)-distance(a))[0]||primary;return[rgbHex(...primary),rgbHex(...accent)];}catch{return["#2563eb","#60a5fa"];}}
async function photoData(url){if(!url)return"";try{const response=await fetch(LOCAL?`/__team-photo?url=${encodeURIComponent(url)}`:url,{cache:"no-store"});if(!response.ok)return"";const bitmap=await createImageBitmap(await response.blob()),size=480,canvas=document.createElement("canvas");canvas.width=size;canvas.height=size;const context=canvas.getContext("2d"),scale=Math.max(size/bitmap.width,size/bitmap.height);context.drawImage(bitmap,(size-bitmap.width*scale)/2,(size-bitmap.height*scale)/2,bitmap.width*scale,bitmap.height*scale);bitmap.close?.();return canvas.toDataURL("image/jpeg",.84);}catch{return"";}}
async function importCalendar(type,url){if(LOCAL){const response=await fetch(`/__team-calendar?teamId=${encodeURIComponent(stagedProfile.teamId)}&type=${encodeURIComponent(type)}&url=${encodeURIComponent(url)}`,{cache:"no-store"}),payload=await response.json();if(!response.ok)throw new Error(payload.error||"Calendario non disponibile");return payload.calendar;}const {data,error}=await supabaseClient.functions.invoke("import-tuttocampo-calendar",{body:{type,url,teamId:Number(stagedProfile.teamId),appTeamId:activeAppTeamId}});if(error)throw new Error(error.message||"Calendario non disponibile");return data?.calendar;}
async function createTeam(selected){
  if(!stagedProfile)return;
  const button=document.querySelector('#configForm button[type="submit"]')||document.getElementById("createTeam");button.disabled=true;button.textContent="Preparo la squadra…";
  const now=new Date(),fallbackStartYear=now.getMonth()>=6?now.getFullYear():now.getFullYear()-1;
  const season=document.getElementById("seasonName").value.trim(),startYear=Number(season.slice(0,4))||fallbackStartYear;
  const paymentStartMonth=Number(document.getElementById("startMonth").value)||8,paymentEndMonth=Number(document.getElementById("endMonth").value)||5,feeMode=document.getElementById("feeMode").value,paymentMode=document.getElementById("paymentMode").value==="rolling"?"rolling":"due_day",paymentDueDay=Math.min(28,Math.max(1,Number(document.getElementById("paymentDueDay").value)||15)),monthlyBase=Math.max(0,Number(document.getElementById("monthlyBase").value)||0),entryFee=Math.max(0,Number(document.getElementById("entryFee").value)||0),cupUrl=document.getElementById("cupCalendar").value.trim(),leagueUrl=document.getElementById("leagueCalendar").value.trim()||stagedProfile.calendarUrl;
  let leagueSnapshot=null,cupSnapshot=null;
  const calendarWarnings=[];
  const leagueResult=await importCalendar("league",leagueUrl).then(value=>({value})).catch(error=>({error}));
  if(leagueResult.value)leagueSnapshot=leagueResult.value;else calendarWarnings.push("campionato");
  if(cupUrl){const cupResult=await importCalendar("cup",cupUrl).then(value=>({value})).catch(error=>({error}));if(cupResult.value)cupSnapshot=cupResult.value;else calendarWarnings.push("coppa");}
  const selectedPlayers=selected.filter(member=>member.kind!=="staff"),[primary,accent]=await logoColors(),players=selectedPlayers.map(member=>member.name),playerBirthDates={},playerPhotos={};
  selectedPlayers.forEach(member=>{if(member.birthDate)playerBirthDates[member.name]=member.birthDate;});
  const photoResults=await Promise.all(selectedPlayers.map(async member=>({name:member.name,data:await photoData(member.photoUrl)})));
  photoResults.forEach(({name,data})=>{if(data)playerPhotos[name]=data;});
  const initialState={
    team:stagedProfile.name,
    teamLogo:stagedProfile.logo,
    season,
    seasonConfig:{
      tuttocampoTeamId:Number(stagedProfile.teamId),
      teamProfile:stagedProfile,
      monthlyBase,
      paymentStartMonth,
      paymentEndMonth,
      paymentFrequency:"monthly",
      paymentMode,
      paymentDueDay,
      monthOverrides:{},
      calendarSources:[
        {type:"league",name:"Campionato",enabled:true,url:leagueUrl,snapshot:leagueSnapshot},
        {type:"cup",name:"Coppa",enabled:Boolean(cupUrl),dynamic:true,refreshPolicy:"after_match",url:cupUrl,snapshot:cupSnapshot}
      ]
    },
    seasonArchives:[],theme:"light",players,playerStartMonths:Object.fromEntries(players.map(name=>[name,`${startYear}-${String(paymentStartMonth).padStart(2,"0")}`])),fines:[],payments:{},
    playerBirthDates,playerPhotos,adminUsername,adminPasswordHash:await passwordHash(adminPassword),
    teamCustomization:{shortName:document.getElementById("appName").value.trim()||"Multe Squadra",fullName:stagedProfile.name,motto:document.getElementById("teamMotto").value.trim(),linkType:"tuttocampo",publicUrl:document.getElementById("teamPublicUrl").value.trim()||stagedProfile.teamUrl,teamLink:document.getElementById("teamPublicUrl").value.trim()||stagedProfile.teamUrl,primary,secondary:darken(primary),accent,colorsCustomized:true,feeMode,entryFee,feesEnabled:feeMode!=="none"}
  };
  if(LOCAL){localStorage.setItem("multesquadra_preview_v1",JSON.stringify(initialState));localStorage.setItem("multe-squadra-demo-profile",JSON.stringify(stagedProfile));}
  else{const configured=await supabaseClient.rpc("configure_team",{p_team_id:activeAppTeamId,p_name:stagedProfile.name,p_tuttocampo_team_id:Number(stagedProfile.teamId),p_logo_url:stagedProfile.logo,p_primary_color:primary,p_accent_color:accent,p_settings:{teamProfile:stagedProfile},p_state:initialState});if(configured.error){button.disabled=false;button.textContent="Crea e apri l’app";alert(configured.error.message||"Salvataggio non riuscito");return;}localStorage.setItem("multesquadra_active_team_v1",activeAppTeamId);}
  if(calendarWarnings.length)sessionStorage.setItem("multesquadra_setup_notice",`Squadra creata. Il calendario ${calendarWarnings.join(" e ")} verrà recuperato dal comando Aggiorna info.`);
  location.href="index.html?configured=1";
}
async function loadRoster(){if(!stagedProfile)return;const status=document.getElementById("rosterStatus"),list=document.getElementById("rosterList"),loginForm=document.getElementById("tuttocampoLoginForm");status.className="status";status.textContent="Carico la rosa da Tuttocampo…";loginForm.classList.add("hidden");let payload=null,remoteError="";try{if(LOCAL){const response=await fetch(`/__team-roster?teamId=${encodeURIComponent(stagedProfile.teamId)}`,{cache:"no-store"});payload=await response.json();if(!response.ok)throw new Error(payload.error||"Rosa non disponibile");}else{const result=await supabaseClient.functions.invoke("import-tuttocampo-calendar",{body:{mode:"roster",teamId:Number(stagedProfile.teamId),appTeamId:activeAppTeamId,teamUrl:stagedProfile.teamUrl}});if(result.error){let message=result.error.message||"Rosa non disponibile";try{const details=await result.error.context?.json();message=details?.error||message;}catch{}throw new Error(message);}payload=result.data;}}catch(error){remoteError=error instanceof Error?error.message:"Rosa non disponibile";}if(!(payload?.members||[]).length)try{const cached=await fetch(`data/roster-cache/${encodeURIComponent(stagedProfile.teamId)}.json`,{cache:"no-store"});if(cached.ok)payload=await cached.json();}catch{}rosterMembers=payload?.members||[];const warning=(payload?.warnings||[]).join(" "),needsLogin=LOCAL&&/richiede l.accesso|accesso Tuttocampo/i.test(warning);status.textContent=rosterMembers.length?`${rosterMembers.length} persone trovate. Scegli chi importare.${remoteError?" Ultima copia verificata.":warning?` ${warning}`:""}`:(remoteError?`Rosa non disponibile: ${remoteError}. Riprova tra poco oppure continua senza importare.`:(warning||"Nessuna persona pubblicata: puoi continuare senza importare."));status.className=`status${!rosterMembers.length?" error":""}`;loginForm.classList.toggle("hidden",!needsLogin);list.innerHTML=rosterMembers.map((member,index)=>`<label class="roster-person">${member.photoUrl?`<img src="${escapeHtml(member.photoUrl)}" alt="">`:`<span class="roster-avatar">${escapeHtml(member.name.split(/\s+/).map(part=>part[0]).slice(0,2).join(""))}</span>`}<span><strong>${escapeHtml(member.name)}</strong><small>${escapeHtml(member.kind==="staff"?(member.role||"Staff"):(member.birthDate?member.birthDate.split("-").reverse().join("/"):"Giocatore"))}</small></span><input type="checkbox" data-roster-index="${index}" checked></label>`).join("");}
confirmButton.addEventListener("click",async()=>{if(!stagedProfile)return;show(rosterPanel);await loadRoster();});
document.getElementById("tuttocampoLoginForm").addEventListener("submit",async event=>{event.preventDefault();const status=document.getElementById("tuttocampoLoginStatus"),button=event.currentTarget.querySelector("button");status.className="status";status.textContent="Verifico l’account…";button.disabled=true;try{const response=await fetch("/__team-tuttocampo-login",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({username:document.getElementById("tuttocampoUsername").value,password:document.getElementById("tuttocampoPassword").value})}),payload=await response.json();if(!response.ok)throw new Error(payload.error||"Accesso non riuscito");document.getElementById("tuttocampoPassword").value="";status.textContent="Account collegato. Ricarico la rosa…";await loadRoster();}catch(error){status.className="status error";status.textContent=error.message;}finally{button.disabled=false;}});
document.getElementById("selectAllRoster").onclick=()=>document.querySelectorAll("[data-roster-index]").forEach(input=>input.checked=true);
document.getElementById("selectNoRoster").onclick=()=>document.querySelectorAll("[data-roster-index]").forEach(input=>input.checked=false);
const monthNames=["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno","Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"];
for(const id of ["startMonth","endMonth"]){document.getElementById(id).innerHTML=monthNames.map((name,index)=>`<option value="${index+1}">${name}</option>`).join("");}
document.getElementById("startMonth").value="8";document.getElementById("endMonth").value="5";
function updateFeeFields(){const mode=document.getElementById("feeMode").value;document.getElementById("monthlyFeeField").classList.toggle("hidden",!['monthly','monthly_entry'].includes(mode));document.getElementById("entryFeeField").classList.toggle("hidden",!['entry','monthly_entry'].includes(mode));}
function openConfiguration(selected){selectedRoster=selected;const now=new Date(),year=now.getMonth()>=6?now.getFullYear():now.getFullYear()-1,cup=stagedProfile.competitions?.find(item=>item.type==="cup");document.getElementById("seasonName").value=`${year}/${String(year+1).slice(-2)}`;document.getElementById("appName").value=`Multe ${stagedProfile.name}`;document.getElementById("teamPublicUrl").value=stagedProfile.teamUrl||"";document.getElementById("leagueCalendar").value=stagedProfile.calendarUrl||"";document.getElementById("cupCalendar").value=cup?.url||"";updateFeeFields();show(configPanel);}
document.getElementById("createTeam").onclick=()=>openConfiguration([...document.querySelectorAll("[data-roster-index]:checked")].map(input=>rosterMembers[Number(input.dataset.rosterIndex)]).filter(Boolean));
document.getElementById("skipRoster").onclick=()=>openConfiguration([]);
document.getElementById("configForm").addEventListener("submit",event=>{event.preventDefault();if(!/^\d{4}\/\d{2}$/.test(document.getElementById("seasonName").value.trim()))return alert("Inserisci la stagione nel formato 2026/27.");createTeam(selectedRoster);});
document.getElementById("feeMode").addEventListener("change",updateFeeFields);
document.getElementById("backRoster").onclick=()=>show(rosterPanel);
document.getElementById("backTeam").onclick=()=>show(teamPanel);
document.getElementById("backLogin").addEventListener("click",()=>show(loginPanel));
document.getElementById("restart").addEventListener("click",()=>{stagedProfile=null;document.getElementById("teamCode").value="";document.getElementById("teamSearch").value="";document.getElementById("searchResults").innerHTML="";statusBox.textContent="";preview.classList.add("hidden");confirmButton.classList.add("hidden");show(loginPanel);});

(async()=>{if(!LOCAL&&supabaseClient){const resetRequested=new URLSearchParams(location.search).get("reset")==="1";if(resetRequested){await supabaseClient.auth.signOut();localStorage.removeItem("multesquadra_active_team_v1");localStorage.removeItem("multesquadra_preview_v1");localStorage.removeItem("multe-squadra-demo-profile");history.replaceState({},"",location.pathname);}const {data:{session}}=await supabaseClient.auth.getSession();const savedTeam=localStorage.getItem("multesquadra_active_team_v1");if(session&&savedTeam){activeAppTeamId=savedTeam;show(teamPanel);}else if(session?.user){await recoverExistingTeam(session.user.id).catch(()=>false);}}})();
