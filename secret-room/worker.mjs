const assets = {"/":["<!doctype html>\n<html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"><title>Secret Chat · Kanish</title><link rel=\"stylesheet\" href=\"/room.css\"><script defer src=\"/room.js\"></script></head>\n<body><main><h2>Are yaar, khul jayega! Ek dafa try karo. Maine tumhare hisaab se customize kiya hai.</h2><br>\n<header><span class=\"mark\" aria-hidden=\"true\">✦</span><div><p class=\"brand\">KANISH</p><h1>Secret Chat</h1></div><button id=\"lock\" class=\"quiet\" hidden>Lock room</button></header>\n<section id=\"gate\"><div id=\"profiles\" class=\"bar\"><button id=\"admin\" type=\"button\">Admin</button><button id=\"kanish\" type=\"button\">Kanish</button></div><p id=\"intro\">Checking the room…</p><form id=\"entry\" hidden><div id=\"fields\"></div><button id=\"enter\">Unlock room</button></form></section>\n<section id=\"room\" hidden><div class=\"bar\"><h2>Conversation</h2><span id=\"identity\"></span><button class=\"quiet\" id=\"refresh\">Refresh</button></div><button class=\"quiet\" id=\"older\" hidden>Load older messages</button><ol id=\"messages\" aria-label=\"Saved messages\"></ol>\n<form id=\"compose\"><label for=\"message\">Write a message</label><textarea id=\"message\" rows=\"4\" maxlength=\"4000\" placeholder=\"Jo kehna hai, yahan likho…\" required></textarea><button>Save message</button></form></section>\n<p id=\"status\" role=\"status\" aria-live=\"polite\"></p></main></body></html>","text/html"],"/room.css":[":root{color-scheme:dark;font:1rem/1.55 system-ui,sans-serif;background:#100e17;color:#faf2ee;--muted:#c9bac8;--line:#4b394b;--accent:#f8bbc6}*{box-sizing:border-box}[hidden]{display:none!important}body{margin:0;min-height:100vh;display:grid;align-items:center;padding:clamp(1rem,5vw,4rem);background:radial-gradient(ellipse at 25% 12%,#402437,transparent 56%),radial-gradient(ellipse at 100% 90%,#201d36,transparent 55%)}main{width:min(100%,43rem);margin:auto;background:#19141feF;border:1px solid var(--line);border-radius:1.4rem;padding:clamp(1.1rem,5vw,2.5rem);box-shadow:0 2rem 5rem #09060d88}header,.bar{display:flex;gap:1rem;align-items:center}header{border-bottom:1px solid var(--line);padding-bottom:1.1rem;margin-bottom:1.3rem}.mark{color:var(--accent);font-size:1.5rem;display:grid;place-items:center;width:2.5rem;height:2.5rem;border:1px solid var(--line);border-radius:50%;flex:none}.brand{font-size:.8rem;letter-spacing:.22em;color:var(--accent);margin:0}h1,h2{font-family:Georgia,serif;font-weight:normal;line-height:1.1;margin:0}h1{font-size:clamp(1.65rem,5vw,3rem)}h2{font-size:1.6rem}#lock,.bar button{margin-left:auto}p,time{color:var(--muted)}label{display:block;margin:1rem 0 .35rem}input,textarea{display:block;width:100%;background:#110e17;border:1px solid var(--line);border-radius:.55rem;color:inherit;padding:.7rem;font:inherit}textarea{resize:vertical}button{border:1px solid transparent;border-radius:.55rem;background:var(--accent);color:#291323;font:inherit;font-weight:650;padding:.55rem .85rem;cursor:pointer}form button{margin-top:1rem}.quiet{background:transparent;border-color:var(--line);color:var(--accent);white-space:nowrap}button:disabled{opacity:.6;cursor:wait}:focus-visible{outline:2px solid var(--accent);outline-offset:3px}#messages{list-style:none;padding:0;max-height:45vh;overflow:auto}#messages li{background:#251b2b;border:1px solid #392a3e;margin:.55rem 0;padding:.65rem .8rem;border-radius:.65rem;overflow-wrap:anywhere;white-space:pre-wrap}time{display:block;font-size:.8rem}#older{margin-top:.8rem}#status:empty{display:none}#status{color:var(--accent);margin-bottom:0}\n#profiles button[aria-pressed=true]{outline:2px solid var(--accent);outline-offset:3px} #identity{color:var(--muted)}","text/css"],"/room.js":["const get = id => document.getElementById(id);\nconst gate=get('gate'), room=get('room'), entry=get('entry'), compose=get('compose'), lock=get('lock');\nconst messages=get('messages'), older=get('older'), status=get('status'), editor=get('message');\nconst labels={admin:'Admin',kanish:'Kanish'};\nlet profile=null;\nlet setup=false, questions=[], entries=[], pending, loading=false;\nasync function api(action, data={}) {\n  const response=await fetch('/api/'+action,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});\n  const result=await response.json();\n  if(!response.ok) throw Object.assign(new Error(result.error),{status:response.status});\n  return result;\n}\nfunction field(name,label,type='text',max=180){\n  const caption=document.createElement('label'), input=document.createElement('input');\n  input.id=input.name=name; input.type=type; input.autocomplete='off'; input.maxLength=max; input.required=true;\n  caption.htmlFor=name; caption.textContent=label; get('fields').append(caption,input);\n}\nasync function showGate(selected=null){\n  profile=selected;\n  for(const key of Object.keys(labels)) get(key).setAttribute('aria-pressed',String(key===profile));\n  room.hidden=lock.hidden=true; messages.replaceChildren(); entries=[]; gate.hidden=false; entry.hidden=true;\n  get('intro').textContent='Choose Admin or Kanish to log in.';\n  if(!profile)return;\n  get('intro').textContent='Checking '+labels[profile]+'…';\n  const config=await api('questions',{profile});\n  questions=config.questions; setup=questions===null;\n  get('fields').replaceChildren();\n  get('intro').textContent=setup?'Use the setup code and choose three questions for this profile.':'Koi bhi do sahi jawab do. Teesra khaali chhod sakte ho.';\n  get('enter').textContent=setup?(config.upgrade?'Update room':'Create room'):'Unlock room';\n  if(setup) field('code','One-time setup code','password',64);\n  for(let i=0;i<3;i++){\n    if(setup) field('q'+i,'Question '+(i+1));\n    field('a'+i,setup?'Answer '+(i+1):questions[i],'password'); get('a'+i).required=setup;\n  }\n  entry.hidden=false;\n}\nfunction showRoom(list){\n  entries=list; render(); get('fields').replaceChildren(); gate.hidden=true; room.hidden=lock.hidden=false;\n}\nfunction render(){\n  const nodes=entries.map(item=>{\n    const li=document.createElement('li'), time=document.createElement('time');\n    time.dateTime=item.created_at; time.textContent=(labels[item.author]||'Earlier message')+' · '+new Date(item.created_at).toLocaleString();\n    li.append(time,document.createTextNode(item.body)); return li;\n  });\n  if(!nodes.length){const li=document.createElement('li');li.textContent='Abhi koi message nahi hai.';nodes.push(li);}\n  messages.replaceChildren(...nodes);\n}\nasync function refresh(){\n  const result=await api('read'); get('identity').textContent=labels[result.profile]||''; older.hidden=result.messages.length<50; showRoom(result.messages);\n  messages.scrollTop=messages.scrollHeight;\n}\nfunction run(button,task){\n  if(loading)return; loading=true; button.disabled=true; status.textContent='';\n  task().catch(async error=>{\n    if(error.status===401&&!room.hidden){try{await showGate();}catch{}}\n    status.textContent=error.message||'Please try again.';\n  }).finally(()=>{loading=false;button.disabled=false;});\n}\nfor(const key of Object.keys(labels)) get(key).onclick=()=>run(get(key),()=>showGate(key));\nentry.addEventListener('submit',event=>{\n  event.preventDefault();\n  run(get('enter'),async()=>{\n    const data=new FormData(entry);\n    const answers=[0,1,2].map(i=>data.get('a'+i));\n    await api(setup?'setup':'unlock',setup?{profile,answers,questions:[0,1,2].map(i=>data.get('q'+i)),code:data.get('code').trim()}:{profile,answers});\n    await refresh();\n  });\n});\ncompose.addEventListener('submit',event=>{\n  event.preventDefault();\n  run(compose.querySelector('button'),async()=>{\n    const body=editor.value.trim();\n    if(!body){status.textContent='Pehle message likho.';return;}\n    if(pending?.body!==body)pending={id:crypto.randomUUID(),body};\n    await api('send',pending); pending=null;\n    if(editor.value.trim()===body)editor.value='';\n    status.textContent='Message saved.';\n    await refresh();\n  });\n});\nlock.onclick=()=>run(lock,async()=>{await api('lock');editor.value='';pending=null;await showGate();});\nget('refresh').onclick=()=>run(get('refresh'),refresh);\nolder.onclick=()=>run(older,async()=>{\n  const first=entries[0], height=messages.scrollHeight;\n  const result=await api('read',{before:first.created_at,beforeId:first.id});\n  older.hidden=result.messages.length<50;entries=[...result.messages,...entries];render();\n  messages.scrollTop=messages.scrollHeight-height;\n});\nrefresh().catch(error=>{\n  if(error.status===401)return showGate();\n  throw error;\n}).catch(error=>{get('intro').textContent=error.message||'Room unavailable. Please try again.';});","text/javascript"]};
const headers={"Cache-Control":"no-store","X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer","X-Robots-Tag":"noindex, nofollow","Content-Security-Policy":"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"};
const encoder=new TextEncoder();
const hex=bytes=>Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
const digest=async value=>hex(await crypto.subtle.digest("SHA-256",encoder.encode(value)));
const cookieName="__Host-kanish_session";
const cookie=(value,age)=>cookieName+"="+value+"; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age="+age;
const json=(value,status=200,extra={})=>Response.json(value,{status,headers:{...headers,...extra}});
const fail=(error,status)=>json({error},status);
const validAnswers=values=>Array.isArray(values)&&values.length===3&&values.every(v=>typeof v==="string"&&v.trim()&&v.length<=180);
const normalize=value=>value.normalize("NFKC").trim().toLowerCase().replace(/\s+/g," ");
function equal(a,b){
  if(a.length!==b.length)return false;
  let difference=0;
  for(let i=0;i<a.length;i++)difference|=a.charCodeAt(i)^b.charCodeAt(i);
  return difference===0;
}
async function answerKey(answers,env){
  const key=await crypto.subtle.importKey("raw",encoder.encode(env.BRIDGE),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  return hex(await crypto.subtle.sign("HMAC",key,encoder.encode(JSON.stringify(answers.map(normalize)))));
}
function answersMatch(expected, actual) {
  return expected.replace(/\s+/gu, "") === actual.replace(/\s+/gu, "");
}
async function baselineKey(env) {
  const material = await crypto.subtle.digest("SHA-256", encoder.encode("kanish-answer-baseline:v1:" + env.BRIDGE));
  return crypto.subtle.importKey("raw", material, "AES-GCM", false, ["encrypt","decrypt"]);
}
async function sealBaseline(values, env) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({name:"AES-GCM",iv}, await baselineKey(env), encoder.encode(JSON.stringify(values)));
  return hex(iv) + hex(encrypted);
}
async function openBaseline(sealed, env) {
  const bytes = Uint8Array.from(sealed.match(/../g), part => parseInt(part,16));
  const plain = await crypto.subtle.decrypt({name:"AES-GCM",iv:bytes.slice(0,12)}, await baselineKey(env), bytes.slice(12));
  return JSON.parse(new TextDecoder().decode(plain));
}
async function rpc(action,data,env){
  const response=await fetch(env.SUPABASE_URL+"/rest/v1/rpc/kanish_secret_rpc",{
    method:"POST",headers:{apikey:env.SUPABASE_KEY,"Content-Type":"application/json"},
    body:JSON.stringify({bridge:env.BRIDGE,action,data})
  });
  if(!response.ok)throw new Error("Database unavailable");
  return response.json();
}
async function readBody(request){
  const reader=request.body?.getReader();
  if(!reader)throw new Error("Missing body");
  const decoder=new TextDecoder();
  let input="", size=0;
  while(true){
    const {value,done}=await reader.read();
    if(done)break;
    size+=value.byteLength;
    if(size>24000){await reader.cancel();throw new Error("Body too large");}
    input+=decoder.decode(value,{stream:true});
  }
  return JSON.parse(input+decoder.decode());
}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export default {async fetch(request,env){
  const url=new URL(request.url);
  if(url.hostname!=="secret.kanish.fun")return fail("Unknown host.",404);
  const asset=Object.hasOwn(assets,url.pathname)?assets[url.pathname]:null;
  if(asset && ["GET","HEAD"].includes(request.method)){
    return new Response(request.method==="HEAD"?null:asset[0],{headers:{...headers,"Content-Type":asset[1]+"; charset=utf-8"}});
  }
  const action=url.pathname.slice(5);
  if(!url.pathname.startsWith("/api/")||!["questions","setup","unlock","read","send","lock"].includes(action))return fail("Page not found.",404);
  if(request.method!=="POST"||request.headers.get("Origin")!==url.origin||!/^application\/json(?:;|$)/i.test(request.headers.get("Content-Type")||""))return fail("Request denied.",403);
  let input;
  try{input=await readBody(request);}catch{return fail("Invalid request.",400);}
  if(!input||typeof input!=="object"||Array.isArray(input))return fail("Invalid request.",400);
  const token=request.headers.get("Cookie")?.match(/(?:^|;\s*)__Host-kanish_session=([0-9a-f]{64})(?:;|$)/)?.[1];
  const data={};
  if (["questions","setup","unlock"].includes(action)) {
    if (!["admin","kanish"].includes(input.profile)) return fail("Choose Admin or Kanish.",400);
    data.profile = input.profile;
  }
  let session;
  try{
    if(["read","send","lock"].includes(action)){
      if(!token)return fail("Unlock the room first.",401);
      data.token=token;
    }
    if(action==="setup"||action==="unlock"){
      if (action === "setup" && !validAnswers(input.answers)) return fail("Enter all three answers.",400);
      if (action === "unlock" && (!Array.isArray(input.answers) || input.answers.length !== 3 ||
          !input.answers.every(value => typeof value === "string" && value.length <= 180) ||
          input.answers.filter(value => value.trim()).length < 2)) {
        return fail("Enter at least two answers.",400);
      }
      if(action==="setup"){
        if(typeof input.code!=="string"||!equal(await digest(input.code),env.SETUP_HASH))return fail("Incorrect setup code.",403);
        if(!validAnswers(input.questions))return fail("Enter all three questions.",400);
        data.questions=input.questions.map(q=>q.trim());
      }
      const submitted = input.answers.map(normalize);
      data.answers = await answerKey(input.answers, env);
      if (action === "setup") {
        data.baseline = await sealBaseline(submitted, env);
      } else {
        const {baseline, error, status} = await rpc("answer_baseline", {profile:data.profile}, env);
        if (error) return fail(error, status);
        if (baseline === null) {
          if (!validAnswers(input.answers)) return fail("For this first unlock, enter all three exact answers.",400);
          data.baseline = await sealBaseline(submitted, env);
        } else {
          try {
            const expected = await openBaseline(baseline, env);
            if (expected.filter((answer, i) => submitted[i] && answersMatch(answer, submitted[i])).length >= 2) {
              data.answers = await answerKey(expected, env);
            }
          } catch {
            // Exact login remains available if the encrypted answers cannot be decoded.
          }
        }
      }
      session=hex(crypto.getRandomValues(new Uint8Array(32)));
      data.token=session;
    }
    if(action==="send"){
      if(typeof input.id!=="string"||!uuid.test(input.id)||typeof input.body!=="string"||!input.body.trim()||input.body.length>4000)return fail("Enter a message of up to 4,000 characters.",400);
      data.id=input.id; data.body=input.body.trim();
    }
    if(action==="read"&&(input.before!==undefined||input.beforeId!==undefined)){
      if(typeof input.before!=="string"||!/^\d{4}-\d\d-\d\dT/.test(input.before)||!Number.isFinite(Date.parse(input.before))||typeof input.beforeId!=="string"||!uuid.test(input.beforeId))return fail("Invalid message history cursor.",400);
      data.before=input.before; data.beforeId=input.beforeId;
    }
    const result=await rpc(action,data,env);
    if(result.error)return fail(result.error,result.status);
    const extra=session?{"Set-Cookie":cookie(session,43200)}:action==="lock"?{"Set-Cookie":cookie("",0)}:{};
    return json(result,200,extra);
  }catch{return fail("Database temporarily unavailable. Please try again.",503);}
}};
