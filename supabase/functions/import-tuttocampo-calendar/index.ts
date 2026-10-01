import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const corsHeaders={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type, x-supabase-api-version","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,"content-type":"application/json; charset=utf-8"}});

const headers={"user-agent":"Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15","accept-language":"it-IT,it;q=0.9",referer:"https://www.tuttocampo.it/"};
const serviceUser=String(Deno.env.get("TUTTOCAMPO_USERNAME")||"").trim();
const servicePassword=String(Deno.env.get("TUTTOCAMPO_PASSWORD")||"");
const serviceCookie=String(Deno.env.get("TUTTOCAMPO_COOKIE")||"").trim();
const clean=(value="")=>value.replace(/<[^>]+>/g," ").replace(/&nbsp;/g," ").replace(/&amp;/g,"&").replace(/&#39;/g,"'").replace(/&quot;/g,'"').replace(/\s+/g," ").trim();
const absolute=(value:string,base:string)=>{try{return new URL(value,base).href;}catch{return"";}};
const validSource=(value:string)=>{try{const url=new URL(value);return url.protocol==="https:"&&/(^|\.)tuttocampo\.it$/i.test(url.hostname)&&/\/(Calendario|Risultati)\/?$/i.test(url.pathname);}catch{return false;}};

function rememberCookies(response:Response,cookies:Map<string,string>){const rawValues=[...(typeof response.headers.getSetCookie==="function"?response.headers.getSetCookie():[]),response.headers.get("set-cookie")].filter(Boolean) as string[],values=rawValues.flatMap(value=>String(value).split(/,(?=\s*[^;,=\s]+=[^;,]*)/));for(const value of values){const pair=String(value).trim().split(";",1)[0],separator=pair.indexOf("=");if(separator>0)cookies.set(pair.slice(0,separator),pair.slice(separator+1));}}
function serviceCookies(){const cookies=new Map<string,string>();for(const part of serviceCookie.split(/;\s*/)){const separator=part.indexOf("=");if(separator>0)cookies.set(part.slice(0,separator),part.slice(separator+1));}return cookies;}
function sessionHeaders(cookies?:Map<string,string>,extra:Record<string,string>={}){const cookie=cookies?[...cookies].map(([name,value])=>`${name}=${value}`).join("; "):"";return{...headers,...(cookie?{cookie}:{}),...extra};}
async function fetchWithCookies(url:string,cookies:Map<string,string>,options:RequestInit={}){let current=url,method=String(options.method||"GET").toUpperCase(),body=options.body;for(let redirects=0;redirects<8;redirects+=1){const response=await fetch(current,{...options,method,body,redirect:"manual",headers:sessionHeaders(cookies,options.headers as Record<string,string>||{})});rememberCookies(response,cookies);if(![301,302,303,307,308].includes(response.status))return response;const location=response.headers.get("location");if(!location)return response;current=absolute(location,current);if(response.status===303||((response.status===301||response.status===302)&&method==="POST")){method="GET";body=undefined;options={...options,headers:{}};}}throw new Error("Troppi reindirizzamenti Tuttocampo");}
async function serviceSession(){const durable=serviceCookies();if(durable.size)return durable;if(!serviceUser||!servicePassword)return null;const cookies=new Map<string,string>();await fetchWithCookies("https://www.tuttocampo.it/",cookies);const body=new URLSearchParams({username:serviceUser,password:servicePassword,remind_me:"remind_me",destination_page:"",submit_login:"Accedi"}),login=await fetchWithCookies("https://www.tuttocampo.it/Web/Views/Login/LoginModal.php",cookies,{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded","origin":"https://www.tuttocampo.it","referer":"https://www.tuttocampo.it/","x-requested-with":"XMLHttpRequest"},body});if(!login.ok)throw new Error(`Accesso Tuttocampo non riuscito (${login.status})`);await login.text();if(!cookies.has("USER")||!cookies.has("VERDATA"))throw new Error("Accesso Tuttocampo non riuscito");return cookies;}
async function page(url:string,cookies?:Map<string,string>){const response=cookies?await fetchWithCookies(url,cookies):await fetch(url,{redirect:"follow",headers});if(!response.ok)throw new Error(`Tuttocampo ha risposto ${response.status}`);return{html:await response.text(),url:response.url};}
function normalizeBirthDate(value:string){const match=String(value||"").match(/\b(\d{1,2})[\/-](\d{1,2})[\/-](19\d{2}|20\d{2})\b/);return match?`${match[3]}-${match[2].padStart(2,"0")}-${match[1].padStart(2,"0")}`:"";}
function parseRosterFragment(html:string,kind:"player"|"staff"){
  const members=[];
  for(const rowMatch of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)){
    const row=rowMatch[0];if(/<th\b/i.test(row))continue;
    const link=row.match(/<a\b[^>]*href=["']([^"']*\/(?:Giocatore|Allenatore|Staff)\/[^"']*)["'][^>]*>([\s\S]*?)<\/a>/i);
    const explicit=row.match(/data-(?:full-?name|player-?name)=["']([^"']+)["']/i)?.[1],first=row.match(/data-name=["']([^"']+)["']/i)?.[1],last=row.match(/data-surname=["']([^"']+)["']/i)?.[1];
    const name=clean(explicit||(last||first?`${last||""} ${first||""}`:link?.[2]||""));if(!name||name.length<3||/^modifica|profilo$/i.test(name))continue;
    const image=row.match(/(?:data-src|src)=["']([^"']*\/(?:Players|Users|Staff)\/[^"']+)["']/i)?.[1]||"";
    const cells=[...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(cell=>clean(cell[1]));
    const birthIndex=cells.findIndex(cell=>/\b\d{1,2}[\/-]\d{1,2}[\/-](?:19|20)\d{2}\b/.test(cell));
    const role=clean(row.match(/<td\b[^>]*class=["'][^"']*(?:role|ruolo)[^"']*["'][^>]*>([\s\S]*?)<\/td>/i)?.[1]||((birthIndex>=0&&cells[birthIndex+1])||""));
    const id=Number((link?.[1]||row).match(/\/(\d+)(?:\/|\?|$)/)?.[1]||row.match(/data-(?:player-)?id=["'](\d+)/i)?.[1]||0);
    members.push({id,name,kind,role,birthDate:normalizeBirthDate(clean(row)),photoUrl:image?absolute(image,"https://www.tuttocampo.it/"):"",profileUrl:link?absolute(link[1],"https://www.tuttocampo.it/"):""});
  }
  return members;
}
async function roster(teamId:number,teamUrl:string){
  const rosterUrl=teamUrl.replace(/\/Scheda\/?$/i,"/Rosa"),staffUrl=teamUrl.replace(/\/Scheda\/?$/i,"/Staff"),cookies=serviceCookies(),source=await page(rosterUrl,cookies);
  const directPlayers=parseRosterFragment(source.html,"player");
  const directStaff=await page(staffUrl,cookies).then(result=>parseRosterFragment(result.html,"staff")).catch(()=>[]);
  if(directPlayers.length||directStaff.length){const unique=new Map<string,unknown>();[...directPlayers,...directStaff].forEach(member=>unique.set(`${member.kind}|${member.id||member.name.toLocaleLowerCase("it")}`,member));return{teamId,members:[...unique.values()],checkedAt:new Date().toISOString()};}
  const token=source.html.match(/var\s+tckk\s*=\s*["']([^"']+)/i)?.[1];
  if(!token)throw new Error("Rosa Tuttocampo temporaneamente non leggibile");
  const load=async(kind:"player"|"staff",view:string,cookies?:Map<string,string>)=>{const current=cookies?await page(rosterUrl,cookies):source,currentToken=current.html.match(/var\s+tckk\s*=\s*["']([^"']+)/i)?.[1]||token,response=await fetch(`https://www.tuttocampo.it/Web/Views/${view}?tckk=${encodeURIComponent(currentToken)}&v=1`,{headers:sessionHeaders(cookies,{"accept":"text/html, */*; q=0.01","x-requested-with":"XMLHttpRequest",referer:rosterUrl})});if(cookies)rememberCookies(response,cookies);if(!response.ok)return[];return parseRosterFragment(await response.text(),kind);};
  let [players,staff]=await Promise.all([load("player","TeamPlayers/TeamPlayers.php",cookies),load("staff","TeamStaffView/TeamStaffView.php",cookies)]);
  if(!players.length){const serviceCookies=await serviceSession();if(serviceCookies)[players,staff]=await Promise.all([load("player","TeamPlayers/TeamPlayers.php",serviceCookies),load("staff","TeamStaffView/TeamStaffView.php",serviceCookies)]);}
  const unique=new Map<string,unknown>();[...players,...staff].forEach(member=>unique.set(`${member.kind}|${member.id||member.name.toLocaleLowerCase("it")}`,member));
  if(!unique.size)throw new Error(serviceUser?"Tuttocampo non ha restituito una rosa per questa squadra":"Importazione rose non configurata: manca l’account di servizio Tuttocampo");
  return{teamId,members:[...unique.values()],checkedAt:new Date().toISOString(),source:"tuttocampo"};
}
function teamFromCell(cell:string,ownId:number){const link=cell.match(/href=["']([^"']*\/Squadra\/[^"']*\/(\d+)\/Scheda)["'][^>]*class=["'][^"']*team-name[^"']*["'][^>]*>([\s\S]*?)<\/a>/i)||cell.match(/class=["'][^"']*team-name[^"']*["'][^>]*href=["']([^"']*\/Squadra\/[^"']*\/(\d+)\/Scheda)["'][^>]*>([\s\S]*?)<\/a>/i);if(!link)return null;const id=Number(link[2]),small=cell.match(/data-src=["']([^"']+)/i)?.[1]||"";return{id,name:clean(link[3]),logo:id===ownId?`https://b2-content.tuttocampo.it/Teams/Original/${id}.png?v=2`:absolute(small.replace(/\/Teams\/(?:40|80)\//,"/Teams/Original/"),"https://www.tuttocampo.it/")};}
function inferDate(partial:string,season:string){if(/^\d{4}-\d{2}-\d{2}$/.test(partial))return partial;const found=partial.match(/^(\d{2})\/(\d{2})(?:\/(\d{2,4}))?$/);if(!found)return"";const start=Number(season.match(/20\d{2}/)?.[0]||new Date().getFullYear());let year=found[3]?Number(found[3]):Number(found[2])>=7?start:start+1;if(year<100)year+=2000;return`${year}-${found[2]}-${found[1]}`;}
function inferItalianDate(value:string,season:string){
  const months:Record<string,number>={gennaio:1,febbraio:2,marzo:3,aprile:4,maggio:5,giugno:6,luglio:7,agosto:8,settembre:9,ottobre:10,novembre:11,dicembre:12};
  const found=clean(value).toLocaleLowerCase("it").match(/\b(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\b/);if(!found)return"";
  const month=months[found[2]],start=Number(season.match(/20\d{2}/)?.[0]||new Date().getFullYear()),year=month>=7?start:start+1;
  return`${year}-${String(month).padStart(2,"0")}-${found[1].padStart(2,"0")}`;
}
function parseCalendar(html:string,ownId:number,type:"league"|"cup",source:string){
  const teams=new Map<number,unknown>(),matches=[],season=clean(html.match(/(?:Stagione|stagione)\s*(20\d{2}\/\d{2})/i)?.[1]||"")||`${new Date().getFullYear()}/${String(new Date().getFullYear()+1).slice(-2)}`;
  for(const row of html.matchAll(/<tr\b[^>]*class=["'][^"']*\bmatch\b[^"']*["'][^>]*data-link=["']([^"']+)["'][^>]*>([\s\S]*?)<\/tr>/gi)){
    const cells=[...row[2].matchAll(/<td\b[^>]*class=["']([^"']*)["'][^>]*>([\s\S]*?)<\/td>/gi)],home=teamFromCell(cells.find(cell=>/\bhome\b/i.test(cell[1]))?.[2]||"",ownId),away=teamFromCell(cells.find(cell=>/\baway\b/i.test(cell[1]))?.[2]||"",ownId);if(!home||!away||(home.id!==ownId&&away.id!==ownId))continue;
    teams.set(home.id,home);teams.set(away.id,away);const round=Number(clean(cells.find(cell=>/match-day/i.test(cell[1]))?.[2]||"").match(/\d+/)?.[0]||0),plain=clean(row[2]),eventJson=row[2].match(/atcb_action\((\{[\s\S]*?\})\s*,\s*button/i)?.[1];let event:any={};try{event=eventJson?JSON.parse(eventJson):{};}catch{}
    const dateTitle=clean(row[2].match(/title=["']([^"']*\bore\s+\d{1,2}:\d{2})["']/i)?.[1]||""),dm=plain.match(/\b(\d{2})\/(\d{2})(?:\/(\d{2,4}))?\b/),partial=event.startDate||(dm?`${dm[1]}/${dm[2]}/${dm[3]||""}`:""),time=event.startTime||dateTitle.match(/\b(?:[01]?\d|2[0-3]):[0-5]\d\b/)?.[0]?.padStart(5,"0")||plain.match(/\b(?:[01]\d|2[0-3]):[0-5]\d\b/)?.[0]||"",goals=[...row[2].matchAll(/class=["'][^"']*goal[^"']*["'][^>]*title=["'][^"']*terminata[^"']*["'][^>]*>\s*(\d+)/gi)].map(item=>item[1]),date=inferDate(partial,season)||inferItalianDate(dateTitle,season);if(!date||!time)continue;
    matches.push({round,homeId:home.id,awayId:away.id,date,time,place:event.location||"",result:goals.length===2?`${goals[0]}-${goals[1]}`:"",status:goals.length===2?"played":"scheduled",url:absolute(row[1],"https://www.tuttocampo.it/"),key:`${type}|${date}|${home.id}|${away.id}`,competitionType:type});
  }
  return{type,competition:clean(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||"").replace(/^Calendario\s+/i,"").slice(0,140),season,source,importedAt:new Date().toISOString(),teams:[...teams.values()],matches,venues:{}};
}
function parseStandings(html:string){const rows=[];for(const found of html.matchAll(/<tr\b[^>]*data-team-id=["'](\d+)["'][^>]*>([\s\S]*?)<\/tr>/gi)){const cells=[...found[2].matchAll(/<td\b([^>]*)>([\s\S]*?)<\/td>/gi)].map(item=>({className:item[1].match(/class=["']([^"']*)/)?.[1]||"",body:item[2]})),teamCell=cells.find(cell=>/\bteam\b/.test(cell.className)&&!/team_logo/.test(cell.className)),name=clean(teamCell?.body||""),logo=absolute((found[2].match(/data-src=["']([^"']*\/Teams\/(?:40|80)\/[^"']+)/i)?.[1]||"").replace(/\/Teams\/(?:40|80)\//,"/Teams/Original/"),"https://www.tuttocampo.it/");const values=cells.filter(cell=>!/(last_match|team_logo|\bteam\b|details)/.test(cell.className)).map(cell=>Number(clean(cell.body)));if(name&&values.length>=8)rows.push({position:rows.length+1,id:Number(found[1]),name,logo,points:values[0],played:values[1],won:values[2],drawn:values[3],lost:values[4],goalDifference:values[7]});}return rows;}
async function calendar(teamId:number,type:"league"|"cup",source:string){let cookies=serviceCookies(),initial=await page(source,cookies),data=parseCalendar(initial.html,teamId,type,source);const loadFragment=async()=>{const token=initial.html.match(/var\s+tckk\s*=\s*["']([^"']+)/i)?.[1];if(!token)return;const fragment=await fetch(`https://www.tuttocampo.it/Web/Views/TeamCalendar/TeamCalendar.php?tckk=${encodeURIComponent(token)}&v=1`,{headers:sessionHeaders(cookies,{"accept":"text/html, */*; q=0.01","x-requested-with":"XMLHttpRequest",referer:source})});rememberCookies(fragment,cookies);if(fragment.ok)data=parseCalendar(await fragment.text(),teamId,type,source);};if(!data.matches.length)await loadFragment();if(!data.matches.length){const serviceCookies=await serviceSession();if(serviceCookies){cookies=serviceCookies;initial=await page(source,cookies);data=parseCalendar(initial.html,teamId,type,source);if(!data.matches.length)await loadFragment();}}if(!data.matches.length)throw new Error("Nessuna partita trovata; l’ultima copia valida resta invariata");if(type==="league"){const root=new URL(source).pathname.match(/^(\/[^/]+\/[^/]+\/[^/]+)/)?.[1];if(root)try{const ranking=await page(`https://www.tuttocampo.it${root}/Classifica`,cookies),token=ranking.html.match(/var\s+tckk\s*=\s*["']([^"']+)/i)?.[1],roundId=ranking.html.match(/var\s+roundID\s*=\s*["']([^"']+)/i)?.[1],matchDay=ranking.html.match(/var\s+currentMatchDay\s*=\s*["'](\d+)/i)?.[1]||"";if(token&&roundId){const response=await fetch(`https://www.tuttocampo.it/Web/Views/Rankings/RankingView.php?tckk=${encodeURIComponent(token)}&category_id=${encodeURIComponent(roundId)}&match_day_id=${encodeURIComponent(matchDay)}&total=true&is_ranking_tab=true`,{headers:sessionHeaders(cookies,{"accept":"text/html, */*; q=0.01","x-requested-with":"XMLHttpRequest",referer:`https://www.tuttocampo.it${root}/Classifica`})});rememberCookies(response,cookies);if(response.ok){const rows=parseStandings(await response.text());if(rows.length)(data as any).standings={competition:data.competition,updatedAt:new Date().toISOString(),rows};}}}catch{}}return data;}
async function profile(teamId:number){
  const short=`https://www.tuttocampo.it/Squadra/${teamId}/Scheda`,response=await fetch(short,{redirect:"follow",headers});if(!response.ok)throw new Error(`Tuttocampo ha risposto ${response.status}`);const html=await response.text(),canonical=response.url.replace(/\?.*$/,"");
  if(!new URL(canonical).pathname.includes(`/${teamId}/`))throw new Error("La pagina trovata non corrisponde al codice");
  const title=clean(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||""),heading=clean(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]||""),slug=decodeURIComponent(new URL(canonical).pathname.match(/\/Squadra\/([^/]+)\//i)?.[1]||"Squadra").replace(/([a-z])([A-Z])/g,"$1 $2"),name=heading||title.split(/[|–-]/)[0].replace(/^Scheda\s+/i,"").trim()||slug;
  const leaguePath=new URL(canonical).pathname.match(/^(\/[^/]+\/[^/]+\/[^/]+)/)?.[1]||"",league=leaguePath?leaguePath.split("/").filter(Boolean).slice(1).join(" · "):"Competizione Tuttocampo",calendarUrl=canonical.replace(/\/Scheda\/?$/i,"/Calendario"),competitions=[{type:"league",name:"Campionato",url:calendarUrl}],section=html.match(/Competizioni\s+stagione[\s\S]*?<ul[^>]*>([\s\S]*?)<\/ul>/i)?.[1]||"",seen=new Set([calendarUrl]);
  for(const match of section.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)){const competitionName=clean(match[2]);if(!/(coppa|trofeo|cup)/i.test(competitionName))continue;const linked=new URL(absolute(match[1],canonical)),root=linked.pathname.match(/^(\/[^/]+\/[^/]+\/[^/]+)/)?.[1];if(!root)continue;const url=new URL(`${root}/Squadra/${slug.replace(/\s+/g,"")}/${teamId}/Calendario`,linked.origin).href;if(!seen.has(url)){seen.add(url);competitions.push({type:"cup",name:competitionName,url});}}
  return{teamId,name,slug,logo:`https://b2-content.tuttocampo.it/Teams/Original/${teamId}.png?v=2`,teamUrl:canonical,league,calendarUrl,competitions,detectedAt:new Date().toISOString()};
}

Deno.serve(async request=>{
  if(request.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
  if(request.method!=="POST")return json({error:"Metodo non consentito"},405);
  try{
    const authorization=request.headers.get("authorization")||"";if(!authorization.startsWith("Bearer "))return json({error:"Accesso richiesto"},401);
    const userClient=createClient(Deno.env.get("SUPABASE_URL")||"",Deno.env.get("SUPABASE_ANON_KEY")||"",{global:{headers:{Authorization:authorization}}});
    const {data:{user}}=await userClient.auth.getUser();if(!user)return json({error:"Sessione non valida"},401);
    const body=await request.json().catch(()=>({})),teamId=Number(body.teamId),appTeamId=String(body.appTeamId||""),mode=String(body.mode||"calendar"),type: "league"|"cup"=body.type==="cup"?"cup":"league";
    if(!Number.isInteger(teamId)||teamId<1)return json({error:"Codice squadra non valido"},400);
    const teamQuery=userClient.from("teams").select("id,name,tuttocampo_team_id,settings");
    const {data:team}=appTeamId?await teamQuery.eq("id",appTeamId).maybeSingle():await teamQuery.eq("tuttocampo_team_id",teamId).maybeSingle();
    if(!team)return json({error:"Squadra non associata all’account"},403);
    const {data:membership}=await userClient.from("team_memberships").select("role").eq("team_id",team.id).eq("user_id",user.id).maybeSingle();if(!membership)return json({error:"Operazione non autorizzata"},403);
    if(team.tuttocampo_team_id&&Number(team.tuttocampo_team_id)!==teamId)return json({error:"Il codice non appartiene a questa squadra"},409);
    if(mode==="profile")return json({profile:await profile(teamId)});
    const profileUrl=String(team.settings?.teamProfile?.teamUrl||body.teamUrl||"");
    if(mode==="roster"){if(!profileUrl)return json({error:"Pagina squadra non configurata"},400);return json(await roster(teamId,profileUrl));}
    const source=String(body.url||"");if(!validSource(source))return json({error:"Link calendario Tuttocampo non valido"},400);
    return json({calendar:await calendar(teamId,type,source)});
  }catch(error){console.error("import-tuttocampo-calendar",error);return json({error:error instanceof Error?error.message:"Aggiornamento non riuscito"},422);}
});
