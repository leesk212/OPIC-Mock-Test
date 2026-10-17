
(() => {
  const PAGE=document.body.dataset.page;
  const $ = id => document.getElementById(id) || document.createElement('div');
  const P=new URLSearchParams(location.search);
  const kst = () => new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const TODAY = kst();
  const fmt = s => { s=Math.max(0,Math.round(s)); return Math.floor(s/60)+':'+String(s%60).padStart(2,'0'); };

  // ---------- fallback bank (used only when no set was prepared for today) ----------
  const T = {d:'묘사',h:'루틴·습관',p:'과거 경험',c:'비교·변화',rp1:'롤플레이 · 질문하기',rp2:'롤플레이 · 문제 해결',rp3:'롤플레이 · 관련 경험',a1:'어드밴스 · 변화',a2:'어드밴스 · 이슈·의견',intro:'자기소개'};
  const SURVEY = {
    '공원가기':{d:"You indicated in the survey that you like to go to parks. Tell me about one of the parks you often go to. What does it look like, and why do you like going there?",h:"What do you usually do when you go to the park? Who do you go with, and what is your routine from the moment you arrive?",p:"Tell me about a memorable experience you had at a park. When was it, who were you with, and what happened that made it so memorable?",c:"How have parks in your neighborhood changed compared to when you were younger? What is different now?"},
    '걷기':{d:"You said you enjoy walking. Where do you usually walk? Describe the place for me in detail.",h:"Tell me about your walking routine. When do you walk, how long do you walk, and what do you do while walking?",p:"Tell me about a time when something unexpected happened while you were taking a walk. Give me all the details.",c:"How has the way you walk or exercise changed over the years? Compare what you did in the past with what you do now."},
    '조깅':{d:"You indicated that you go jogging. Where do you usually jog, and what is that place like?",h:"Describe your typical jogging routine. What do you do before, during, and after jogging?",p:"Tell me about a memorable day when you went jogging. What happened, and why do you still remember it?",c:"When did you first start jogging? How is the way you jog now different from when you first started?"},
    '영화보기':{d:"You said you like watching movies. What kinds of movies do you like, and why do you enjoy them?",h:"Tell me about your routine when you watch a movie. Where do you watch it, who do you watch it with, and what do you do before and after?",p:"Tell me about a movie that left a strong impression on you. When did you see it, and what made it so memorable?",c:"How has the way people watch movies changed compared to the past? Compare watching movies back then with watching them today."},
    '음악 감상':{d:"You indicated that you enjoy listening to music. What kinds of music do you like, and who are some of your favorite musicians?",h:"When and where do you usually listen to music? What device do you use, and how does music fit into your daily routine?",p:"Tell me about how you first became interested in music. What kind of music did you listen to back then, and how has your taste changed?",c:"Pick two kinds of music you like. How are they similar, and how are they different?"},
    '카페':{d:"You said you go to coffee shops. Tell me about a coffee shop you like to go to. Where is it, and what does it look like?",h:"What do you usually do when you go to a coffee shop? Describe a typical visit from start to finish.",p:"Tell me about a memorable experience you had at a coffee shop. What happened, and who were you with?",c:"How have coffee shops changed compared to the past? What role do coffee shops play in people's lives today?"},
    '스포츠 관람':{d:"You indicated that you like watching sports. What sport do you like to watch, and what makes it exciting for you?",h:"How do you usually watch games? Do you go to the stadium or watch at home? Tell me about your routine on game day.",p:"Tell me about the most memorable game you have ever watched. When was it, where were you, and what happened?",c:"Compare watching a game at the stadium with watching it at home. Which do you prefer, and why?"},
    '축구':{d:"You said you play soccer. Tell me about the place where you play and the people you usually play with.",h:"When did you first start playing soccer? What position did you play, and how did you learn the game?",p:"Tell me about a memorable soccer match you played in. What happened during the game?",c:"Who is your favorite soccer player? How has that player's style or career changed over time?"},
    '노래 부르기':{d:"You indicated that you like to sing. When and where do you usually sing, and what kinds of songs do you sing?",h:"Tell me about the first time you became interested in singing. What songs did you sing back then?",p:"Tell me about a memorable time you sang in front of other people. What happened, and how did you feel?",c:"How have the ways people enjoy singing changed compared to the past?"},
    '국내여행':{d:"You said you like to travel in your country. Tell me about a place you like to visit. What is it like there?",h:"What do you usually do to prepare for a trip in your country? Walk me through your process from planning to packing.",p:"Tell me about a memorable trip you took in your country. Where did you go, who were you with, and what happened?",c:"How has domestic travel changed compared to when you were younger?"},
    '해외여행':{d:"You indicated that you have traveled abroad. Tell me about a country you have visited. What was it like?",h:"What do you usually do before you go on a trip abroad? Tell me about how you prepare.",p:"Tell me about something unexpected that happened during a trip abroad. How did you deal with it?",c:"Compare the first trip you took abroad with a recent one. How were they different?"},
    '집에서 보내는 휴가':{d:"You said you like to spend your vacations at home. Tell me what a typical vacation at home looks like for you.",h:"Who do you usually spend time with when you take a vacation at home, and what do you do together?",p:"Tell me about a memorable vacation you spent at home. What did you do, and why was it special?",c:"How is spending a vacation at home now different from when you were younger?"},
    '사는 곳':{d:"You indicated that you live alone in a house. Describe your home for me. What is your favorite room, and why?",h:"Tell me about your daily routine at home on a typical weekday.",p:"Tell me about a change you made to your home. What did you change, and why?",c:"Compare the home you live in now with a home you lived in when you were younger."}
  };
  const DROP = {
    '미용실':{d:"I'd like to know about the hair salon you usually go to. Where is it, and what does it look like inside?",h:"What do you usually do when you go to the hair salon? Tell me about a typical visit from start to finish.",p:"Tell me about a memorable experience at a hair salon. Maybe a time the stylist did something you didn't like. What happened?",c:"How have hair salons changed compared to the past? What is different about them now?"},
    '은행':{d:"Let's talk about banks. Tell me about the bank you use. Where is it, and what does it look like?",h:"What do you usually do when you go to the bank? Describe the process from the moment you walk in.",p:"Tell me about a memorable experience you had at a bank. Maybe there was a problem. What happened and how was it resolved?",c:"How has banking changed over the years? Compare how people did banking in the past with how they do it now."},
    '기술':{d:"What kind of technology do you use most often in your daily life? Describe it and tell me how you use it.",h:"How do people in your country typically use technology in their free time?",p:"Tell me about a time when a piece of technology didn't work the way you expected. What happened, and what did you do?",c:"How has the way people spend their free time changed because of technology? Compare the past and the present."},
    '휴대폰':{d:"Tell me about the phone you use. What do you usually use it for?",h:"How often do you use your phone during the day? Describe your typical phone habits.",p:"Tell me about a memorable experience related to your phone. Maybe you lost it or it broke. What happened?",c:"How have phones changed since you got your first one? Compare your first phone with the one you use now."},
    '인터넷':{d:"What do people around you usually use the internet for? Give me some examples.",h:"Tell me about the websites or apps you visit regularly. What do you do on them?",p:"Tell me about a time you found something interesting or surprising while searching online.",c:"How has searching for information changed compared to the past? Compare how you looked things up back then and now."},
    '날씨':{d:"What is the weather like in your country? Describe the different seasons.",h:"What do people in your country do to stay comfortable during very hot or very cold weather?",p:"Tell me about a memorable experience you had because of the weather.",c:"How has the weather in your country changed compared to when you were young?"},
    '재활용':{d:"Tell me about how people recycle in your country. What do they recycle, and how?",h:"Describe how you recycle at home. What is your routine?",p:"Tell me about a time when you had a problem with recycling.",c:"How has recycling changed compared to the past?"},
    '교통':{d:"Describe the transportation system in your area. How do people usually get around?",h:"How do you usually get to work or school? Describe your commute.",p:"Tell me about a memorable experience you had while using public transportation.",c:"How has transportation in your area changed over the past few years?"}
  };
  const RP = [
    {t:'약속',q:["Your friend invited you to a dinner party this weekend. Call your friend and ask three or four questions to find out more about the party.","I'm sorry, but there is a problem that I need you to resolve. Something came up, and you can't go to the party. Call your friend, explain the situation, and offer two or three alternatives.","That's the end of the situation. Have you ever had to cancel plans with someone because something came up? Tell me what happened and how you handled it."]},
    {t:'미용실 예약',q:["You want to get a haircut this weekend. Call the hair salon and ask three or four questions to make an appointment.","I'm sorry, but there is a problem. When you arrive, the salon tells you your appointment was not recorded and there are no stylists available. Explain the situation and suggest two or three alternatives.","That's the end of the situation. Have you ever been unhappy with a haircut or a service at a salon? Tell me what happened."]},
    {t:'은행',q:["You want to open a new bank account. Call the bank and ask three or four questions about opening an account.","I'm sorry, but there is a problem. You lost your bank card. Call the bank, explain the situation, and ask what you should do.","That's the end of the situation. Tell me about a time you had a problem with money or a bank. What happened, and how did you solve it?"]},
    {t:'빌린 물건',q:["Your friend has a new MP3 player you would like to borrow. Call your friend and ask three or four questions about it.","I'm sorry, but there is a problem. You borrowed the MP3 player and it broke. Call your friend, explain what happened, and offer two or three ways to fix the situation.","That's the end of the situation. Have you ever broken or lost something that belonged to someone else? Tell me what happened."]},
    {t:'경기 티켓',q:["You want to watch a soccer game with a friend. Call the ticket office and ask three or four questions to get tickets.","I'm sorry, but there is a problem. On the day of the game, it is cancelled because of heavy rain. Call your friend, explain the situation, and suggest two or three alternatives.","That's the end of the situation. Tell me about a time your plans were ruined by something you couldn't control."]},
    {t:'영화 예매',q:["You want to see a movie this weekend. Call the theater and ask three or four questions about the movie and tickets.","I'm sorry, but there is a problem. You bought tickets for the wrong date and the show you wanted is sold out. Call the theater, explain, and suggest two or three alternatives.","That's the end of the situation. Tell me about a time something went wrong when you went to see a movie."]}
  ];
  const ADV = {
    '기술':["Technology has changed the way people spend their free time. How do people's leisure activities today differ from those of ten years ago? Give specific examples.","Some people worry that people spend too much time on their devices in their free time. What are people saying about this issue, and what is your opinion?"],
    '휴대폰':["Phones have changed a lot in recent years. What are some features people want in phones these days, and why?","What are some concerns or problems people talk about related to phones? Tell me what you know about them."],
    '인터넷':["How has the internet changed the way people find information compared to the past?","What are some concerns people have about using the internet, such as privacy? Tell me about them."],
    '카페':["What role do coffee shops play in people's lives today compared to the past?","What are some issues or concerns related to coffee shops these days, such as prices or the environment?"],
    '은행':["How has technology changed the way people use banks? Compare the past and the present in detail.","What are some concerns people have about mobile banking or online banking these days?"],
    '음악 감상':["How has the way people listen to music changed over the years? Talk about the changes in detail.","Some people say that streaming services and AI recommendations change people's taste in music. What do you think about that?"],
    '영화보기':["How has the movie industry changed in recent years? Talk about the changes you have noticed.","What are some issues people talk about regarding movies or streaming services these days?"],
    '날씨':["How has climate change affected the weather in your country? Give specific examples.","What are people in your country doing to deal with climate change? What is your opinion?"]
  };
  function rng(seed){let h=1779033703^seed.length;for(let i=0;i<seed.length;i++){h=Math.imul(h^seed.charCodeAt(i),3432918353);h=h<<13|h>>>19}return()=>{h=Math.imul(h^h>>>16,2246822507);h=Math.imul(h^h>>>13,3266489909);return((h^=h>>>16)>>>0)/4294967296}}
  function fallbackSet(date){
    const r=rng(date); const pick=a=>a[Math.floor(r()*a.length)];
    const sk=Object.keys(SURVEY); const s1=pick(sk); let s2=pick(sk); while(s2===s1) s2=pick(sk);
    const dk=Object.keys(DROP); const d1=pick(dk);
    const rp=pick(RP); const ak=Object.keys(ADV); const a=pick(ak);
    const combo=(bank,topic,keys)=>keys.map(k=>({type:k,topic,text:bank[topic][k]}));
    const qs=[{type:'intro',topic:'자기소개',text:"Let's start the interview now. Tell me a little bit about yourself."},
      ...combo(SURVEY,s1,['d','h','p']),...combo(DROP,d1,['d','h','c']),...combo(SURVEY,s2,['d','c','p']),
      {type:'rp1',topic:rp.t,text:rp.q[0]},{type:'rp2',topic:rp.t,text:rp.q[1]},{type:'rp3',topic:rp.t,text:rp.q[2]},
      {type:'a1',topic:a,text:ADV[a][0]},{type:'a2',topic:a,text:ADV[a][1]}];
    return {date,theme:`${s1} · ${d1}(돌발) · ${s2} · ${rp.t} 롤플레이 · ${a} 어드밴스`,questions:qs,source:'fallback'};
  }



  // ---------- state ----------
  let SET=null, started=false, sampleMode=(P.get('sample')==='1'), QS=[], LIMIT=2400;
  let idx=0, plays=0, playEndAt=0, ansStart=0, totalStart=0, diffChoice=null, tickT=null, replayT=null, finished=false;
  const log=[];
  // audio
  let stream=null, ac=null, analyser=null, recorder=null, chunks=[], micOK=false, meterT=null;
  let SR=window.SpeechRecognition||window.webkitSpeechRecognition, rec=null, finalText='', srOK=false;

  function setReady(set,label){
    SET=set; $('kDate').textContent=set.date; $('kTheme').textContent=`${set.theme||'—'} (${label})`;
    $('kNote').textContent=set.note||'MP 첫 문장 · 과거엔 다른 사람 1명 · 끝에 미래 1문장';
    $('btnBegin').disabled=false; $('btnSample').disabled=false; $('btnFull').disabled=false;
  }

  // ---------- mic ----------
  async function initMic(){
    try{
      stream=await navigator.mediaDevices.getUserMedia({audio:true});
      ac=new (window.AudioContext||window.webkitAudioContext)();
      const src=ac.createMediaStreamSource(stream); analyser=ac.createAnalyser(); analyser.fftSize=512; src.connect(analyser);
      micOK=true; $('micBox').classList.add('ok');
      $('micMsg').innerHTML='<span class="okc">녹음 가능</span> · 질문이 끝나면 자동으로 녹음돼요.'+(SR?' 받아쓰기도 같이 돼요.':'');
      startMeter(); return true;
    }catch(e){
      micOK=false;
      $('micMsg').textContent='마이크 권한이 막혀 있어요. 주소창 왼쪽 아이콘에서 마이크를 허용한 뒤 새로고침하세요.';
      micOff();
      return false;
    }
  }
  let lvl=0, lastHeard=0;
  function startMeter(){
    const buf=new Uint8Array(analyser.fftSize);
    clearInterval(meterT);
    meterT=setInterval(()=>{
      if(ac && ac.state==='suspended'){ ac.resume().catch(()=>{}); }
      analyser.getByteTimeDomainData(buf); let sum=0; for(const v of buf){const d=(v-128)/128; sum+=d*d}
      const rms=Math.sqrt(sum/buf.length); const target=Math.min(1,rms*7);
      lvl = target>lvl ? target : lvl*0.82+target*0.18;
      const pct=Math.round(lvl*100), heard=lvl>0.09; if(heard) lastHeard=Date.now();
      const recNow=document.body.classList.contains('recording');
      $('meterFill').style.height=pct+'%'; $('setupFill').style.width=pct+'%'; $('vfill').style.width=pct+'%';
      $('setupHear').textContent= heard ? '목소리 들림' : '조용함';
      const vs=$('vstat');
      if(recNow){ const on=Date.now()-lastHeard<600; vs.className='vstat '+(on?'hear':'wait'); $('vtxt').textContent= on ? '녹음 중 · 목소리가 들려요' : '녹음 중 · 말해 보세요'; }
      else { vs.className='vstat'; $('vtxt').textContent= plays? '질문 재생 중' : '질문을 들으면 녹음이 시작돼요'; }
    },60);
  }
  function micOff(){ const vs=$('vstat'); vs.className='vstat off'; $('vtxt').textContent='마이크 없음 · 주소창에서 마이크를 허용하고 새로고침하세요'; $('setupHear').textContent='마이크 없음'; }
  const wake=()=>{ if(ac && ac.state==='suspended') ac.resume().catch(()=>{}); };
  document.addEventListener('click', wake, true);
  $('btnMic').onclick=async()=>{ $('btnMic').disabled=true; const ok=await initMic(); $('btnMic').disabled=false; $('btnMic').textContent= ok?'마이크 다시 확인':'다시 시도'; };

  function startRecording(){
    $('stage').classList.add('recording'); document.body.classList.add('recording');
    if(micOK && window.MediaRecorder){ chunks=[]; try{recorder=new MediaRecorder(stream); recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)}; recorder.start();}catch(e){recorder=null} }
    finalText=''; $('live').textContent='';
    if(micOK && SR){ try{ rec=new SR(); rec.lang='en-US'; rec.continuous=true; rec.interimResults=true;
      rec.onresult=ev=>{let interim='';for(let i=ev.resultIndex;i<ev.results.length;i++){const r=ev.results[i];if(r.isFinal)finalText+=r[0].transcript+' ';else interim+=r[0].transcript}
        $('live').textContent=(finalText+interim).trim()||'…'; srOK=true;};
      rec.onend=()=>{ if(rec && document.body.classList.contains('recording')){ try{rec.start()}catch(e){} } };
      rec.start(); }catch(e){rec=null} }
  }
  function stopRecording(){
    document.body.classList.remove('recording'); $('stage').classList.remove('recording');
    const r=rec; rec=null; if(r){try{r.stop()}catch(e){}}
    return new Promise(res=>{
      if(recorder && recorder.state!=='inactive'){ recorder.onstop=()=>res(new Blob(chunks,{type:recorder.mimeType||'audio/webm'})); recorder.stop(); }
      else res(null);
    });
  }

  // ---------- speech ----------
  let voice=null, rate=1, voices=[];
  const score=v=>{const n=v.name;let s=0;if(/^en[-_]US/i.test(v.lang))s+=30;else if(/^en/i.test(v.lang))s+=10;else return -1;
    if(/natural|neural/i.test(n))s+=60; if(/premium|enhanced/i.test(n))s+=50; if(/^Google US English/i.test(n))s+=45; if(/online/i.test(n))s+=20;
    if(/aria|jenny|ava|samantha|allison|emma|michelle|zoe/i.test(n))s+=12; if(v.localService===false)s+=5; if(/espeak|compact|novelty|whisper|bad news|bells|bubbles|cellos|zarvox|trinoids|albert|jester|organ|superstar|boing|wobble|hysterical/i.test(n))s-=80; return s};
  const lsGet=k=>{try{return localStorage.getItem(k)}catch(e){return null}}, lsSet=(k,v)=>{try{localStorage.setItem(k,v)}catch(e){}};
  function loadVoices(){
    if(!('speechSynthesis' in window)) return;
    voices=speechSynthesis.getVoices().filter(v=>score(v)>=0).sort((a,b)=>score(b)-score(a));
    const sel=$('voiceSel'); sel.innerHTML='';
    voices.forEach((v,i)=>{const o=document.createElement('option');o.value=String(i);o.textContent=v.name+(i===0?'  (추천)':'');sel.appendChild(o)});
    const saved=lsGet('opic.voice'); let i=voices.findIndex(v=>v.name===saved); if(i<0)i=0; sel.value=String(i); voice=voices[i]||null;
    if(!voices.length) $('voiceNote').textContent='영어 음성이 없어요. Edge나 Chrome에서 열어 보세요.';
  }
  if('speechSynthesis' in window){ loadVoices(); speechSynthesis.onvoiceschanged=loadVoices; }
  { const r=lsGet('opic.rate'); if(r){ rate=Number(r)||1; $('rateSel').value=r; } }
  $('voiceSel').onchange=()=>{voice=voices[Number($('voiceSel').value)]||null; if(voice) lsSet('opic.voice',voice.name)};
  $('rateSel').onchange=()=>{rate=Number($('rateSel').value)||1; lsSet('opic.rate',String(rate))};
  $('btnPreview').onclick=()=>speakRaw("You indicated in the survey that you like to go to parks. Tell me about one of the parks you often go to.",()=>{});
  let mouthT=null, fillT=null, keepT=null;
  function speakRaw(text,done){
    speechSynthesis.cancel();
    // one utterance per sentence keeps Chrome from cutting long prompts; pauses fall where a speaker would breathe
    const parts=text.match(/[^.?!]+[.?!]+["']?|[^.?!]+$/g)||[text];
    let i=0;
    const next=()=>{ if(i>=parts.length){clearInterval(keepT);done();return}
      const u=new SpeechSynthesisUtterance(parts[i++].trim()); u.lang='en-US'; u.rate=rate; u.pitch=1; if(voice)u.voice=voice;
      u.onend=next; u.onerror=next; speechSynthesis.speak(u); };
    clearInterval(keepT); keepT=setInterval(()=>{ if(!speechSynthesis.speaking){clearInterval(keepT)} },1000);
    setTimeout(next,60);
  }
  function speak(text,done){
    $('info').hidden=true;
    if(!('speechSynthesis' in window)){ $('qtext').hidden=false; $('qtext').textContent=text; done(); return; }
    const est=Math.max(3,text.split(/\s+/).length/(2.5*rate)), t0=Date.now();
    $('playTxt').textContent='Listening…'; $('btnPlay').disabled=true; $('ava').classList.add('speaking');
    clearInterval(mouthT); mouthT=setInterval(()=>{$('mouth').setAttribute('ry',String(2+Math.random()*5))},120);
    clearInterval(fillT); fillT=setInterval(()=>{$('playFill').style.width=Math.min(100,(Date.now()-t0)/1000/est*100)+'%'},100);
    speakRaw(text,()=>{$('ava').classList.remove('speaking');clearInterval(mouthT);clearInterval(fillT);$('mouth').setAttribute('ry','2');$('playFill').style.width='100%';done()});
  }

  // ---------- flow ----------
  function buildGrid(total){ const g=$('grid'); g.innerHTML=''; for(let i=0;i<total;i++){const s=document.createElement('span');s.textContent=i+1;if(i<idx)s.className='past';else if(i===idx)s.className='now';g.appendChild(s)} }
  function questions(){ return sampleMode ? [{n:1,type:'sample',topic:'Sample',text:"Tell me a little bit about the weather today. What is it like where you are right now?"}] : QS; }
  function showQ(){
    const qs=questions(), q=qs[idx]; plays=0; ansStart=0; playEndAt=0;
    if(!sampleMode) log[idx]={n:q.n||idx+1,type:q.type,topic:q.topic,text:q.text,sec:0,replay:false,text_shown:false,transcript:'',memo:'',audio:null};
    ['vDiff','vEnd'].forEach(v=>$(v).hidden=true); $('vTest').hidden=false;
    $('qof').textContent= sampleMode ? 'Sample Question · Question 1 of 1' : `Question ${idx+1} of ${qs.length}`+(qs.length<15?(q.extra?' · 어드밴스 기출형':` · 실제 ${q.n}번`):'');
    buildGrid(qs.length);
    $('info').hidden=false; $('playFill').style.width='0'; $('playTxt').textContent="Click 'PLAY' button to Listen"; $('btnPlay').disabled=false;
    $('btnNext').disabled=true; $('btnNext').textContent= (sampleMode||idx===qs.length-1)?'Finish >':'Next >';
    $('qtext').hidden=true; $('qtext').textContent=q.text; $('btnText').hidden=false;
    $('live').hidden=!micOK || !SR; $('live').textContent='';
    $('memo').hidden=micOK; $('memo').value='';
    $('ansLbl').textContent= micOK ? (SR?'답변 받아쓰기 (실시간)':'답변 녹음 중에는 볼륨 막대가 움직여요') : '답변 메모';
    if(!micOK) micOff();
    $('ansClock').textContent='답변 0:00'; $('over').hidden=true; $('btnNext').classList.remove('pulse');
  }
  function afterPlay(){
    plays++; playEndAt=Date.now();
    if(plays===1){
      ansStart=Date.now(); startRecording(); $('btnNext').disabled=false;
      $('btnPlay').disabled=false; let left=5; $('playTxt').textContent=`다시 듣기 가능 ${left}초`;
      clearInterval(replayT); replayT=setInterval(()=>{left--; if(left<=0){clearInterval(replayT);$('btnPlay').disabled=true;$('playTxt').textContent='Recording…'} else $('playTxt').textContent=`다시 듣기 가능 ${left}초`},1000);
    } else { $('btnPlay').disabled=true; $('playTxt').textContent='Recording…'; ansStart=Date.now(); startRecording(); }
    if(sampleMode && !tickT){ tickT=setInterval(tick,500); }
  }
  $('btnPlay').onclick=()=>{
    if(plays===0){ speak(questions()[idx].text,afterPlay); return; }
    if(plays===1 && Date.now()-playEndAt<=5200){ clearInterval(replayT); if(!sampleMode) log[idx].replay=true; stopRecording(); speak(questions()[idx].text,afterPlay); }
  };
  $('btnText').onclick=()=>{ $('qtext').hidden=!$('qtext').hidden; if(!$('qtext').hidden && !sampleMode) log[idx].text_shown=true; };
  $('btnNext').onclick=async()=>{
    $('btnNext').disabled=true; if('speechSynthesis' in window) speechSynthesis.cancel(); clearInterval(replayT);
    const blob=await stopRecording();
    if(sampleMode){ location.href='index.html?sampled=1'; return; }
    const L=log[idx]; L.sec=ansStart?Math.round((Date.now()-ansStart)/1000):0; L.transcript=finalText.trim(); L.memo=$('memo').value.trim(); L.audio=blob;
    if(QS.length===15 && idx===6){ idx++; $('vTest').hidden=true; $('vDiff').hidden=false; return; }
    if(idx===QS.length-1) return finish(false);
    idx++; showQ();
  };
  document.querySelectorAll('#vDiff button').forEach(b=>b.onclick=()=>{diffChoice=b.dataset.d; showQ();});
  function tick(){
    const remain=totalStart?LIMIT-(Date.now()-totalStart)/1000:LIMIT; $('clock').textContent=totalStart?'남은 시간 '+fmt(remain):'연습 문항';
    if(ansStart){ const s=(Date.now()-ansStart)/1000; $('ansClock').textContent='답변 '+fmt(s); const o=s>=120; if($('over').hidden===o){ $('over').hidden=!o; $('btnNext').classList.toggle('pulse',o); } }
    if(totalStart && remain<=0 && !finished) finish(true);
  }
  async function finish(timeout){
    if(finished) return; finished=true; clearInterval(tickT);
    if('speechSynthesis' in window) speechSynthesis.cancel();
    if(timeout && log[idx]){ const b=await stopRecording(); const L=log[idx]; L.sec=ansStart?Math.round((Date.now()-ansStart)/1000):0; L.transcript=finalText.trim(); L.memo=$('memo').value.trim(); L.audio=b; }
    ['vTest','vDiff'].forEach(v=>$(v).hidden=true); $('vEnd').hidden=false; $('st5').className='step done';
    const total=Math.round((Date.now()-totalStart)/1000), done=log.filter(Boolean);
    $('endSum').textContent=`${done.length}/${QS.length} 문항 · 총 ${fmt(total)}${timeout?` (${Math.round(LIMIT/60)}분 초과)`:''} · 다시 듣기 ${done.filter(l=>l.replay).length}회 · 문장 보기 ${done.filter(l=>l.text_shown).length}회 · 난이도 재조정: ${({easier:'쉬운',same:'비슷한',harder:'어려운'})[diffChoice]||'—'}`;
    const rows=$('rows'); rows.innerHTML='';
    done.forEach(l=>{ const tr=document.createElement('tr');
      const td=(t,c)=>{const e=document.createElement('td');if(c)e.className=c;if(t!=null)e.textContent=t;tr.appendChild(e);return e};
      td(String(l.n),'n'); td(`${T[l.type]||l.type} · ${l.topic}`); td(fmt(l.sec),'n');
      const c=td(null);
      if(l.audio){ const url=URL.createObjectURL(l.audio); const a=document.createElement('audio'); a.controls=true; a.src=url; a.style.maxWidth='240px'; c.appendChild(a);
        { const d=document.createElement('a'); d.href=url; d.download=`opic-${SET.date}-Q${l.n}.webm`; d.textContent=' 저장'; c.appendChild(d); } }
      const txt=l.transcript||l.memo; if(txt){ const p=document.createElement('div'); p.className='note'; p.textContent=txt; c.appendChild(p); }
      rows.appendChild(tr); });
    const lines=done.map(l=>`Q${l.n} [${T[l.type]||l.type}·${l.topic}] ${fmt(l.sec)}${l.replay?' · 다시듣기':''}${l.text_shown?' · 문장봄':''}\n질문: ${l.text}\n내 답변: ${l.transcript||l.memo||'(받아쓰기 없음 — 녹음 듣고 채워 넣기)'}`);
    $('report').value=`[${SET.date} 모의고사${QS.length<15?` ${QS.length}문항(${TAG})`:''} 채점 요청] 실전 모드 종합 평가 부탁해.\n총 ${fmt(total)} · 난이도 재조정 ${diffChoice||'—'}\n\n`+lines.join('\n\n');
    try{
      $('saveNote').textContent='저장 중…';
      for(const l of done){ if(l.audio){ await fetch(`/api/recording?date=${SET.date}&n=${l.n}`,{method:'POST',headers:{'Content-Type':l.audio.type||'audio/webm'},body:l.audio}); } }
      const resultObj={date:SET.date,part:TAG||'full',count:QS.length,finishedAt:new Date().toISOString(),totalSec:total,difficulty:diffChoice||null,answered:done.length,mode:micOK?'mic':'memo',theme:SET.theme,
        items:done.map(l=>({n:l.n,type:l.type,topic:l.topic,question:l.text,sec:l.sec,replay:l.replay,text_shown:l.text_shown,transcript:l.transcript,memo:l.memo,words:(l.transcript||l.memo).split(/\s+/).filter(Boolean).length,audio:l.audio?`recordings/${SET.date}/Q${l.n}.webm`:null}))};
      const res=await fetch(`/api/result?date=${SET.date}&tag=${TAG}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(resultObj)});
      if(!res.ok) throw 0;
      const saved=await res.json().catch(()=>({}));
      const fbName=saved.name||(SET.date+(TAG?'_'+TAG:''));
      if(window.OPIcFeedback){ $('fbWrap').hidden=false; OPIcFeedback.request($('fbBox'),fbName,resultObj,{statusEl:$('fbStatus')}); $('btnRegrade').onclick=()=>OPIcFeedback.request($('fbBox'),fbName,resultObj,{force:true,statusEl:$('fbStatus')}); }
      $('saveNote').innerHTML=`<span class="okc">저장됨</span> — 오픽 폴더의 recordings/${SET.date}, results/${SET.date}${TAG?'_'+TAG:''}.json · <a href="feedback.html">기록·피드백</a>`;
    }catch(e){ $('saveNote').textContent='저장 실패 — 서버가 켜져 있는지 확인하세요. 채점 요청은 복사해서 보내면 돼요.'; }
  }
  $('btnCopy').onclick=()=>{const t=$('report');navigator.clipboard.writeText(t.value).then(()=>{$('copyNote').textContent='복사됨'}).catch(()=>{t.focus();t.select();$('copyNote').textContent='선택됨 — 직접 복사하세요'})};

  // ---------- 14·15 hard bank (AL-deciding: change over time / issues / opinions) ----------
  const HARD=[
    {topic:'기술',type:'a1',text:"Technology has changed the way people spend their free time. How do people's leisure activities today differ from those of ten years ago? Give me specific examples."},
    {topic:'기술',type:'a2',text:"Some people worry that people spend too much time on their phones and devices during their free time. What are people saying about this issue, and what is your own opinion?"},
    {topic:'AI',type:'a1',text:"Artificial intelligence has become part of everyday life very quickly. How has the way people search for information or get things done changed because of AI? Compare the past and the present."},
    {topic:'AI',type:'a2',text:"There are a lot of concerns about artificial intelligence these days, such as jobs or privacy. Tell me about one issue people are worried about, why it matters, and what you think should be done."},
    {topic:'휴대폰',type:'a1',text:"Phones have changed a lot in recent years. What features do people want in phones these days, and how is that different from what people wanted in the past?"},
    {topic:'휴대폰',type:'a2',text:"Tell me about a problem or concern people have related to phones these days. What caused it, and how are people dealing with it?"},
    {topic:'인터넷',type:'a1',text:"How has the internet changed the way people find information compared to when you were younger? Give me as many details as possible."},
    {topic:'인터넷',type:'a2',text:"What are some concerns people have about using the internet, such as privacy or fake news? Describe one issue in detail and tell me your opinion."},
    {topic:'은행',type:'a1',text:"How has technology changed the way people use banks? Compare how people did their banking in the past with how they do it now."},
    {topic:'은행',type:'a2',text:"Mobile and online banking are very convenient, but some people are worried about them. What concerns do people have, and what do banks do to solve these problems?"},
    {topic:'카페',type:'a1',text:"Cafes today serve as offices, study rooms, and meeting places. How has the role of cafes in your country changed over the years?"},
    {topic:'카페',type:'a2',text:"What are some issues related to cafes these days, such as rising prices, too many cafes, or environmental problems? Explain one issue and give me your opinion."},
    {topic:'공원',type:'a2',text:"What challenges are public parks in your country facing these days? What caused these problems, and what steps should be taken to solve them?"},
    {topic:'공원',type:'a1',text:"Compare the activities that children and adults do at parks. How are the facilities for each group different, and how has that changed over time?"},
    {topic:'여행',type:'a2',text:"What issues or concerns do people have when they travel these days? What causes them, and what is being done to deal with them?"},
    {topic:'여행',type:'a1',text:"How has traveling to other countries changed over the years? Has it become easier or more difficult? Explain with specific examples."},
    {topic:'음악',type:'a1',text:"How has the way people listen to and discover music changed over the years? Talk about streaming services and recommendations in detail."},
    {topic:'음악',type:'a2',text:"What new electronic gadgets or services are music lovers interested in these days? Why are people excited about them, and are there any downsides?"},
    {topic:'영화',type:'a1',text:"Compare the movies made today with the movies you watched when you were growing up. How have movies and the way people watch them changed?"},
    {topic:'영화',type:'a2',text:"Many people now watch movies on streaming services instead of going to theaters. What are people saying about this change, and what is your opinion?"},
    {topic:'스포츠',type:'a1',text:"Do you think the experience of watching sports has changed over time? How does watching games today compare to the past?"},
    {topic:'스포츠',type:'a2',text:"Tell me about an issue or controversy in the world of sports that people have been talking about recently. Why are people interested in it, and what do you think?"},
    {topic:'집',type:'a2',text:"What major problems do people have when they rent a house or an apartment in your country? How do they deal with them, and how do these problems affect where people live?"},
    {topic:'집',type:'a1',text:"How were homes five or ten years ago, and how are they now? What are the biggest characteristics of homes these days?"},
    {topic:'날씨',type:'a1',text:"How has the weather in your country changed compared to when you were young? Give me specific examples of the changes you have noticed."},
    {topic:'날씨',type:'a2',text:"Climate change is a big issue around the world. What are people and the government in your country doing about it, and do you think it is enough?"},
    {topic:'교통',type:'a2',text:"What are some transportation problems in your city, such as traffic jams or crowded subways? What causes them, and what could be done to fix them?"},
    {topic:'재활용',type:'a2',text:"Recycling has become very important. What problems do people face with recycling these days, and what do you think people should do differently?"},
    {topic:'건강',type:'a1',text:"How have the ways people stay healthy changed over the years? Compare what people did in the past with what they do now."},
    {topic:'미용실',type:'a1',text:"How have hair salons and the way people choose their hairstyles changed over the years? Talk about the changes in detail."},
    {topic:'명절',type:'a1',text:"How have holidays in your country changed compared to when you were a child? What do people do differently now?"},
    {topic:'쇼핑',type:'a2',text:"More and more people shop online instead of going to stores. What problems has this created, and how do you feel about this change?"}
  ];
  function pickHard(k, avoidTopics){ const pool=HARD.filter(h=>!avoidTopics.includes(h.topic)); const out=[]; const used=new Set();
    while(out.length<k && pool.length){ const i=Math.floor(Math.random()*pool.length); const h=pool.splice(i,1)[0]; if(used.has(h.topic+h.type)) continue; used.add(h.topic+h.type); out.push(h); } return out; }
  // ---------- parts ----------
  const PARTS={3:[['rand','랜덤 (매번 다른 구간)'],['adv','14·15 어드밴스 집중'],['2','2–4번 · 콤보 1'],['5','5–7번 · 돌발'],['8','8–10번 · 콤보 2'],['11','11–13번 · 롤플레이']],5:[['11','11–15번 · 롤플레이 + 어드밴스']],15:[['1','1–15번 전체']]};
  let TAG='';
  function fillParts(){
    const n=$('countSel').value, sel=$('partSel'); sel.innerHTML='';
    const qs=SET?SET.questions:[];
    PARTS[n].forEach(([from,label])=>{const o=document.createElement('option');o.value=from;const t=qs[Number(from)-1];o.textContent=label+(t&&n==='3'?` (${t.topic})`:'')+(from==='adv'&&qs[13]?` (오늘 ${qs[13].topic} + 기출형 1)`:'');sel.appendChild(o)});
    if(n==='3'){ sel.value='rand'; const s=lsGet('opic.part'); if(s && PARTS[3].some(p=>p[0]===s)) sel.value=s; }
    sel.hidden=(n==='15');
  }
  // ---------- load ----------
  const fb=fallbackSet(TODAY);
  async function loadSet(){
    try{ const r=await fetch('/api/set?date='+TODAY,{cache:'no-store'}); if(r.ok){ const d=await r.json(); if(d&&Array.isArray(d.questions)&&d.questions.length===15) return [d,true]; } }catch(e){}
    return [fb,false];
  }
  if(PAGE==='setup'){
    $('st3').className='step now';
    if(P.get('sampled')==='1'){ $('st3').className='step done'; $('st4').className='step done'; }
    $('setupNote').textContent='오늘 세트를 확인하는 중…';
    { const c=lsGet('opic.count'); if(c && PARTS[c]) $('countSel').value=c; }
    $('countSel').onchange=()=>{ lsSet('opic.count',$('countSel').value); fillParts(); };
    $('partSel').onchange=()=>lsSet('opic.part',$('partSel').value);
    $('btnSample').onclick=()=>{ location.href='exam.html?sample=1'; };
    $('btnFull').onclick=()=>{ location.href='exam.html?n=15&from=1'; };
    $('btnBegin').onclick=()=>{ const n=$('countSel').value, from=n==='15'?'1':(n==='5'?'11':$('partSel').value); location.href=`exam.html?n=${n}&from=${from}`; };
    (async()=>{
      const [d,ok]=await loadSet(); setReady(d, ok?'코치가 준비한 세트':'기본 세트'); fillParts();
      $('setupNote').textContent= ok ? '마이크 테스트로 막대가 움직이는지 확인하고 시작하세요.' : '오늘 준비된 세트가 없어 기본 문제은행으로 만들었어요.';
      initMic();
    })();
  } else {
    ['st3','st4'].forEach(s=>$(s).className='step done'); $('st5').className= sampleMode?'step':'step now'; if(sampleMode) $('st4').className='step now';
    (async()=>{
      const [d]=await loadSet(); SET=d;
      const n=Math.min(15,Math.max(1,Number(P.get('n'))||15)); let fromRaw=P.get('from')||'1';
      const all=d.questions.map((q,i)=>({...q,n:i+1}));
      if(fromRaw==='rand'){ const opts=['adv','2','5','8','11']; fromRaw=opts[Math.floor(Math.random()*opts.length)]; }
      if(fromRaw==='adv'){
        const extra=pickHard(n<=3?1:n-2,[all[13].topic]).map((h,i)=>({...h,n:16+i,extra:true}));
        QS=[...extra, all[13], all[14]].slice(0,Math.max(3,n));
        TAG='ADV';
      } else {
        const from=Math.min(15,Math.max(1,Number(fromRaw)||1));
        QS=all.slice(from-1,from-1+n);
        TAG= QS.length<15 ? `Q${from}-${from+QS.length-1}` : '';
      }
      LIMIT= sampleMode ? 600 : Math.round(2400*QS.length/15);
      await initMic();
      idx=0; started=true; showQ();
      if(!sampleMode){ totalStart=Date.now(); } clearInterval(tickT); tickT=setInterval(tick,500);
    })();
  }
})();
