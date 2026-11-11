(() => {
  const canvas = document.getElementById('world');
  const ctx = canvas.getContext('2d');
  const mini = document.getElementById('minimap');
  const mctx = mini.getContext('2d');
  const $ = id => document.getElementById(id);
  const W = 2600, H = 1900;
  const keys = new Set();
  const classData = {
    avian: {name:'SKYCLAW', species:'Pterosaur', glyph:'♢', color:'#bd9a69', accent:'#e5c998', speed:190, hp:90, damage:24, cold:0},
    mammal: {name:'FANG', species:'Smilodon', glyph:'♧', color:'#b78656', accent:'#e6c084', speed:155, hp:125, damage:30, cold:1},
    amphibian: {name:'MIREBORN', species:'Diplocaulus', glyph:'≈', color:'#628c77', accent:'#a2c39a', speed:130, hp:115, damage:24, cold:0},
    reptile: {name:'RIDGEBACK', species:'Young Rex', glyph:'◈', color:'#788752', accent:'#c6be7c', speed:120, hp:155, damage:37, cold:0}
  };
  const traits = [
    {id:'hide',name:'Ironbark Hide',desc:'Thickened scales reduce incoming damage by 20%.',cost:3,bonus:'−20% DAMAGE TAKEN'},
    {id:'sprint',name:'Burst Muscles',desc:'A stronger sprint response and faster stamina recovery.',cost:2,bonus:'+20% SPRINT SPEED'},
    {id:'fang',name:'Venom-tipped Bite',desc:'A vicious bite deals 30% more damage.',cost:4,bonus:'+30% ATTACK POWER'},
    {id:'senses',name:'Night Prowler',desc:'Heightened senses reveal nearby life and resources.',cost:3,bonus:'WIDER SENSE RANGE'},
    {id:'metabolism',name:'Hardy Metabolism',desc:'Hunger and thirst drain more slowly.',cost:2,bonus:'−35% NEEDS DRAIN'},
    {id:'glide',name:'Wind-carved Feathers',desc:'Adapted limbs let you move 15% faster.',cost:4,bonus:'+15% MOVEMENT'}
  ];
  let selected='avian', started=false, paused=true, last=0, time=0;
  let camera={x:0,y:0}, player=null, dna=0, level=1, objectiveCount=0;
  let animals=[], fossils=[], plants=[], rocks=[], trees=[];
  let toastTimer=0, attackFX=0, mapOpen=false, worldTime=8.23;
  let eventIndex=0, eventTimer=0, currentEvent=0;
  const events=[{name:'MIGRATION SEASON',desc:'Herds gather at the river',icon:'☀'},{name:'MONSOON FRONT',desc:'Rain sweeps across the basin',icon:'⌁'},{name:'FROST MOON',desc:'Cold sharpens the food web',icon:'❄'},{name:'ANCIENT DROUGHT',desc:'Water becomes precious',icon:'◌'},{name:'VOLCANIC ASH',desc:'The earth remembers its fire',icon:'♨'}];
  const rand=(a,b)=>a+Math.random()*(b-a), clamp=(v,a,b)=>Math.max(a,Math.min(b,v)), dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  function resize(){const dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.floor(innerWidth*dpr);canvas.height=Math.floor(innerHeight*dpr);ctx.setTransform(dpr,0,0,dpr,0,0)}
  addEventListener('resize',resize);resize();
  function buildWorld(){
    trees=[];rocks=[];plants=[];fossils=[];animals=[];
    for(let i=0;i<195;i++){const x=rand(45,W-45),y=rand(45,H-45);if(Math.hypot(x-W*.51,y-H*.5)<160)continue;trees.push({x,y,r:rand(18,34),tone:Math.floor(rand(0,4)),kind:Math.random()<.2?'pine':'broad'})}
    for(let i=0;i<125;i++)rocks.push({x:rand(30,W-30),y:rand(30,H-30),r:rand(7,19),tone:Math.floor(rand(0,4))});
    for(let i=0;i<145;i++)plants.push({x:rand(15,W-15),y:rand(15,H-15),kind:Math.floor(rand(0,4)),r:rand(3,8)});
    const spots=[[410,390],[700,790],[1180,360],[1560,680],[2100,360],[2210,1140],[1560,1510],[640,1470],[1080,1100],[1930,875],[390,1060],[1310,1280]];
    for(const [x,y] of spots)fossils.push({x,y,active:true,phase:rand(0,6)});
    const types=[['fern grazer','herb',13],['longneck juvenile','herb',19],['terror bird','pred',15],['smilodon','pred',14],['mammoth','herb',22],['diplocaulus','herb',12],['young rex','pred',19],['pterosaur','herb',13],['eryops','pred',15]];
    for(let i=0;i<28;i++){const type=types[i%types.length],x=rand(100,W-100),y=rand(100,H-100);animals.push({x,y,homeX:x,homeY:y,angle:rand(0,6.28),speed:rand(15,35),name:type[0],kind:type[1],size:type[2],hp:type[1]==='pred'?42:26,maxHp:type[1]==='pred'?42:26,think:rand(1,4),alive:true,alert:0,herd:Math.floor(i/3)})}
  }
  buildWorld();
  document.querySelectorAll('.class-card').forEach(card=>card.addEventListener('click',()=>{document.querySelectorAll('.class-card').forEach(c=>c.classList.remove('selected'));card.classList.add('selected');selected=card.dataset.class}));
  $('begin-button').addEventListener('click',startGame);$('evolve-shortcut').addEventListener('click',openEvolution);$('close-evolution').addEventListener('click',closeEvolution);$('respawn-button').addEventListener('click',respawn);
  $('map-toggle').addEventListener('click',()=>{mapOpen=!mapOpen;notify(mapOpen?'Field survey expanded':'Field survey compact')});
  document.addEventListener('keydown',e=>{if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key))e.preventDefault();keys.add(e.key.toLowerCase());if(e.repeat)return;if(e.key.toLowerCase()==='e'&&started){$('evolution-modal').classList.contains('hidden')?openEvolution():closeEvolution()}if(e.key.toLowerCase()==='f'&&started)interact();if(e.key.toLowerCase()==='m')mapOpen=!mapOpen;if(e.key===' '&&started&&!paused)attack();if(e.key==='Escape')closeEvolution()});
  document.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
  document.querySelectorAll('.touch-pad button').forEach(button=>{const dir=button.dataset.dir,map={up:'w',down:'s',left:'a',right:'d'};button.addEventListener('pointerdown',e=>{e.preventDefault();keys.add(map[dir])});for(const ev of ['pointerup','pointercancel','pointerleave'])button.addEventListener(ev,()=>keys.delete(map[dir]))});
  $('touch-hunt').addEventListener('pointerdown',e=>{e.preventDefault();attack()});$('touch-sprint').addEventListener('pointerdown',e=>{e.preventDefault();keys.add('shift')});for(const ev of ['pointerup','pointercancel','pointerleave'])$('touch-sprint').addEventListener(ev,()=>keys.delete('shift'));
  function startGame(){if(started)return;started=true;paused=false;$('start-modal').classList.add('hidden');const c=classData[selected];player={x:W*.5,y:H*.5,angle:-Math.PI/2,hp:c.hp,maxHp:c.hp,hunger:100,thirst:100,stamina:100,speed:c.speed,damage:c.damage,food:0,traits:new Set(),attackCooldown:0,invuln:0,walk:0};$('species-name').textContent=c.name;$('species-avatar').textContent=c.glyph;$('level-pill').textContent='LV 01';notify(`${c.species} lineage selected. The basin is yours to explore.`);syncHUD();requestAnimationFrame(loop)}
  function openEvolution(){if(!started)return;paused=true;$('evolution-dna').textContent=`${dna} DNA`;renderEvolutions();$('evolution-modal').classList.remove('hidden')}
  function closeEvolution(){if(!$('evolution-modal').classList.contains('hidden')){$('evolution-modal').classList.add('hidden');paused=false;last=performance.now()}}
  function renderEvolutions(){const grid=$('evolution-grid');grid.innerHTML='';for(const t of traits){const owned=player.traits.has(t.id),card=document.createElement('div');card.className=`evo-card ${owned?'owned':''}`;card.innerHTML=`<h3>${t.name}</h3><p>${t.desc}</p><span>${owned?'✦ ADAPTED':`${t.bonus} · ${t.cost} DNA`}</span><button ${owned||dna<t.cost?'disabled':''}>${owned?'OWNED':`EVOLVE · ${t.cost}`}</button>`;card.querySelector('button').addEventListener('click',()=>{if(owned||dna<t.cost)return;dna-=t.cost;player.traits.add(t.id);if(t.id==='hide')player.armor=.2;if(t.id==='fang')player.damage*=1.3;if(t.id==='sprint'||t.id==='glide')player.speed*=t.id==='sprint'?1.1:1.15;renderEvolutions();syncHUD();notify(`${t.name} adaptation complete.`)});grid.appendChild(card)}$('evolution-dna').textContent=`${dna} DNA`}
  function respawn(){$('death-modal').classList.add('hidden');const c=classData[selected];player.x=W*.5;player.y=H*.5;player.hp=c.hp;player.maxHp=c.hp;player.hunger=75;player.thirst=75;player.stamina=100;player.invuln=2;paused=false;last=performance.now();notify('Your lineage returns. Adapt, and endure.')}
  function notify(message){const toast=$('toast');toast.textContent=message;toast.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove('show'),2300);const feed=$('feed'),item=document.createElement('div');item.textContent='✦  '+message;feed.prepend(item);while(feed.children.length>4)feed.lastChild.remove();setTimeout(()=>item.remove(),4800)}
  function attack(){if(!player||paused||player.attackCooldown>0)return;player.attackCooldown=.48;attackFX=.22;let target=null,best=92;for(const a of animals){if(!a.alive)continue;const d=dist(player,a);if(d<best){best=d;target=a}}if(target){target.hp-=player.damage;target.alert=4;target.angle=Math.atan2(target.y-player.y,target.x-player.x);notify(`${target.name} hit · ${Math.max(1,Math.round(player.damage))} damage`);if(target.hp<=0){target.alive=false;dna+=target.kind==='pred'?2:1;player.hunger=Math.min(100,player.hunger+20);player.food++;objectiveCount=Math.min(3,objectiveCount+(target.kind==='herb'?1:0));notify(`${target.name} hunted · +${target.kind==='pred'?2:1} DNA · food restored`);level=Math.floor((dna+2)/4)+1;$('level-pill').textContent=`LV ${String(level).padStart(2,'0')}`;syncHUD()}}else notify('Your strike meets only air. Move closer to your prey.')}
  function interact(){if(!player||paused)return;const nearFossil=fossils.find(f=>f.active&&dist(player,f)<58);if(nearFossil){nearFossil.active=false;dna+=3;objectiveCount++;syncHUD();notify('Fossil energy absorbed · +3 DNA');return}if(player.y>H*.46&&player.y<H*.62&&player.x>W*.34&&player.x<W*.7){player.thirst=100;notify('River water replenished · thirst restored');syncHUD();return}const corpse=animals.find(a=>!a.alive&&dist(player,a)<55);if(corpse){player.hunger=Math.min(100,player.hunger+35);dna+=1;corpse.x=-100;notify('Carcass scavenged · hunger eased · +1 DNA');syncHUD();return}notify('Nothing nearby to interact with. Seek fossils or water.')}
  function syncHUD(){if(!player)return;const set=(id,v)=>$(id).style.width=`${clamp(v,0,100)}%`;set('health-bar',player.hp/player.maxHp*100);set('hunger-bar',player.hunger);set('thirst-bar',player.thirst);set('stamina-bar',player.stamina);$('health-value').textContent=Math.ceil(player.hp);$('hunger-value').textContent=Math.ceil(player.hunger);$('thirst-value').textContent=Math.ceil(player.thirst);$('stamina-value').textContent=Math.ceil(player.stamina);$('dna-count').textContent=dna;const near=fossils.find(f=>f.active&&dist(player,f)<58),atWater=player.y>H*.46&&player.y<H*.62&&player.x>W*.34&&player.x<W*.7,corpse=animals.find(a=>!a.alive&&dist(player,a)<55),prompt=$('interaction-prompt');if(near||atWater||corpse){prompt.textContent=`[ F ] ${near?'ABSORB FOSSIL ENERGY':atWater?'DRINK FROM THE RIVER':'SCAVENGE REMAINS'}`;prompt.classList.add('visible')}else prompt.classList.remove('visible');$('objective-count').textContent=`${objectiveCount} / 3`;if(objectiveCount>=3){$('objective-text').textContent='Claim your first adaptation';$('objective-count').textContent='READY'}else $('objective-text').textContent='Gather fossil energy'}
  function step(dt){if(!player||paused)return;time+=dt;worldTime=(worldTime+dt*.06)%24;eventTimer+=dt;if(eventTimer>37){eventTimer=0;eventIndex=(eventIndex+1)%events.length;currentEvent=eventIndex;const e=events[currentEvent];$('event-name').textContent=e.name;$('event-description').textContent=e.desc;$('event-icon').textContent=e.icon;notify(`World event: ${e.name.toLowerCase()}`)}const c=classData[selected];let mx=0,my=0;if(keys.has('w')||keys.has('arrowup'))my--;if(keys.has('s')||keys.has('arrowdown'))my++;if(keys.has('a')||keys.has('arrowleft'))mx--;if(keys.has('d')||keys.has('arrowright'))mx++;const moving=mx||my,sprinting=keys.has('shift')&&player.stamina>2&&moving;if(moving){const mag=Math.hypot(mx,my);mx/=mag;my/=mag;player.angle=Math.atan2(my,mx);const speed=player.speed*(sprinting?1.55*(player.traits.has('sprint')?1.1:1):1);player.x=clamp(player.x+mx*speed*dt,35,W-35);player.y=clamp(player.y+my*speed*dt,35,H-35);player.walk+=dt*(sprinting?13:8)}player.stamina=clamp(player.stamina+(sprinting?-38:24)*dt,0,100);const needDrain=player.traits.has('metabolism')?.65:1;player.hunger=Math.max(0,player.hunger-.19*dt*needDrain);player.thirst=Math.max(0,player.thirst-(.24+(currentEvent===3?.18:0))*dt*needDrain);if(player.hunger<=0||player.thirst<=0)player.hp=Math.max(0,player.hp-(player.hunger<=0?4:2.5)*dt);player.attackCooldown=Math.max(0,player.attackCooldown-dt);player.invuln=Math.max(0,player.invuln-dt);attackFX=Math.max(0,attackFX-dt);
    for(const a of animals){if(!a.alive)continue;a.think-=dt;const d=Math.hypot(player.x-a.x,player.y-a.y);if(a.kind==='pred'&&d<245){a.alert=Math.max(a.alert,2);a.angle=Math.atan2(player.y-a.y,player.x-a.x);a.x+=Math.cos(a.angle)*(a.speed+20)*dt;a.y+=Math.sin(a.angle)*(a.speed+20)*dt;if(d<29&&player.invuln<=0){player.hp=Math.max(0,player.hp-(10*(1-(player.armor||0))));player.invuln=.8;notify(`${a.name} attacks! Keep moving.`)}}else if(a.alert>0){a.alert-=dt;if(a.kind==='herb'&&d<180){a.angle=Math.atan2(a.y-player.y,a.x-player.x);a.x+=Math.cos(a.angle)*a.speed*2*dt;a.y+=Math.sin(a.angle)*a.speed*2*dt}}else if(a.think<=0){a.think=rand(1.8,4.7);a.angle=rand(0,6.28)}else{a.x+=Math.cos(a.angle)*a.speed*.32*dt;a.y+=Math.sin(a.angle)*a.speed*.32*dt}if(a.x<45||a.x>W-45||a.y<45||a.y>H-45)a.angle+=Math.PI*.7;a.x=clamp(a.x,40,W-40);a.y=clamp(a.y,40,H-40)}
    if(player.hp<=0){paused=true;$('death-modal').classList.remove('hidden')}camera.x=clamp(player.x-innerWidth/2,0,W-innerWidth);camera.y=clamp(player.y-innerHeight/2,0,H-innerHeight);if(Math.floor(time*2)%2===0)syncHUD()}
  function loop(now){if(!started)return;const dt=Math.min(.04,(now-last)/1000||0);last=now;step(dt);render();requestAnimationFrame(loop)}

  function drawMinimap(){
    const w=mini.width,h=mini.height;mctx.clearRect(0,0,w,h);mctx.fillStyle='#374d3c';mctx.fillRect(0,0,w,h);
    // stylized land cover
    for(let i=0;i<70;i++){const x=(i*47)%w,y=(i*71)%h;mctx.fillStyle=i%3===0?'#69734a':'#43583d';mctx.beginPath();mctx.ellipse(x,y,5+(i%7),3+(i%5),i,0,6.28);mctx.fill()}
    mctx.beginPath();mctx.moveTo(w*.23,h*.5);mctx.bezierCurveTo(w*.38,h*.42,w*.46,h*.62,w*.59,h*.54);mctx.bezierCurveTo(w*.7,h*.45,w*.72,h*.55,w*.79,h*.48);mctx.lineTo(w*.8,h*.66);mctx.bezierCurveTo(w*.69,h*.71,w*.64,h*.61,w*.54,h*.67);mctx.bezierCurveTo(w*.42,h*.74,w*.34,h*.55,w*.23,h*.66);mctx.closePath();mctx.fillStyle='#477673';mctx.fill();
    for(const f of fossils){if(!f.active)continue;mctx.fillStyle='#d2e8ad';mctx.fillRect(f.x/W*w-1,f.y/H*h-1,3,3)}
    for(const a of animals){if(!a.alive)continue;mctx.fillStyle=a.kind==='pred'?'#d57f69':'#bcb68a';mctx.beginPath();mctx.arc(a.x/W*w,a.y/H*h,a.kind==='pred'?2:1.5,0,6.28);mctx.fill()}
    if(player){const px=player.x/W*w,py=player.y/H*h;mctx.strokeStyle='#e3edbd88';mctx.lineWidth=1;mctx.beginPath();mctx.arc(px,py,7,0,6.28);mctx.stroke();mctx.fillStyle='#f0edcf';mctx.beginPath();mctx.arc(px,py,3,0,6.28);mctx.fill()}
    mctx.strokeStyle='#e1e4ce55';mctx.lineWidth=2;mctx.strokeRect(1,1,w-2,h-2);
  }
  const point=(x,y)=>({x:x-camera.x,y:y-camera.y});
  function drawTerrain(){
    const w=innerWidth,h=innerHeight;
    ctx.fillStyle='#566b49';ctx.fillRect(0,0,w,h);
    // Broad, softly varied ground patches keep the basin legible without a noisy tile grid.
    const tile=112, sx=Math.floor(camera.x/tile), sy=Math.floor(camera.y/tile);
    for(let gy=sy;gy<sy+h/tile+2;gy++)for(let gx=sx;gx<sx+w/tile+2;gx++){
      const n=Math.abs(Math.sin(gx*127.1+gy*311.7)*43758.5453)%1;
      const x=gx*tile-camera.x,y=gy*tile-camera.y;
      ctx.fillStyle=n>.72?'rgba(147,154,91,.12)':n<.17?'rgba(28,57,42,.11)':'rgba(190,166,103,.035)';
      ctx.beginPath();ctx.ellipse(x+tile*.5,y+tile*.5,tile*(.28+n*.13),tile*(.2+n*.12),n*3,0,Math.PI*2);ctx.fill();
    }
    // Winding river with a shallow bank and luminous water center.
    ctx.save();ctx.translate(-camera.x,-camera.y);ctx.lineCap='round';ctx.lineJoin='round';
    const river=()=>{ctx.beginPath();ctx.moveTo(-120,1030);ctx.bezierCurveTo(340,900,520,1110,880,1010);ctx.bezierCurveTo(1190,920,1320,1040,1630,990);ctx.bezierCurveTo(1930,940,2200,1110,2710,930)};
    river();ctx.strokeStyle='#756f50';ctx.lineWidth=238;ctx.stroke();
    river();ctx.strokeStyle='#4b7770';ctx.lineWidth=204;ctx.stroke();
    river();ctx.strokeStyle='#62877a';ctx.lineWidth=154;ctx.stroke();
    river();ctx.strokeStyle='rgba(185,196,147,.2)';ctx.lineWidth=3;ctx.stroke();
    // Pebble bars and reeds along the waterline.
    for(let i=0;i<38;i++){const x=(i*173+81)%W,y=970+Math.sin(i*1.7)*88;ctx.fillStyle=i%2?'rgba(196,177,120,.23)':'rgba(37,76,61,.28)';ctx.beginPath();ctx.ellipse(x,y,18+(i%5)*5,4+(i%3)*2,Math.sin(i)*.4,0,Math.PI*2);ctx.fill()}
    ctx.restore();
    // Distant scrub silhouettes add depth around the playable basin.
    for(let i=0;i<24;i++){const x=(i*311-camera.x*.2)%(W+120)-60,y=(i%2?70:H-60)-camera.y*.13;ctx.fillStyle='rgba(34,58,43,.18)';ctx.beginPath();ctx.ellipse((x+W+120)%(W+120),y,36+(i%4)*9,11+(i%3)*4,0,0,Math.PI*2);ctx.fill()}
  }
  function drawPlant(p){
    const q=point(p.x,p.y);if(q.x<-20||q.x>innerWidth+20||q.y<-20||q.y>innerHeight+20)return;
    const colors=['#82965b','#b0a65e','#66885a','#a47f4f'];ctx.save();ctx.translate(q.x,q.y);ctx.fillStyle='rgba(20,36,26,.22)';ctx.beginPath();ctx.ellipse(1,3,p.r*1.35,p.r*.55,0,0,Math.PI*2);ctx.fill();
    for(let j=0;j<3;j++){ctx.save();ctx.rotate((j-1)*.62);ctx.fillStyle=colors[(p.kind+j)%colors.length];ctx.beginPath();ctx.ellipse(0,-p.r*.42,p.r*.42,p.r*.92,0,0,Math.PI*2);ctx.fill();ctx.restore()}
    ctx.restore();
  }
  function drawRock(r){
    const q=point(r.x,r.y);if(q.x<-28||q.x>innerWidth+28||q.y<-28||q.y>innerHeight+28)return;
    ctx.save();ctx.translate(q.x,q.y);ctx.fillStyle='rgba(24,33,26,.25)';ctx.beginPath();ctx.ellipse(2,r.r*.48,r.r*1.15,r.r*.52,0,0,Math.PI*2);ctx.fill();
    const tones=['#777965','#938b70','#686e61','#a49775'];ctx.fillStyle=tones[r.tone];ctx.beginPath();ctx.moveTo(-r.r,-r.r*.18);ctx.lineTo(-r.r*.52,-r.r*.78);ctx.lineTo(r.r*.35,-r.r);ctx.lineTo(r.r,.04*r.r);ctx.lineTo(r.r*.48,r.r*.55);ctx.lineTo(-r.r*.7,r.r*.48);ctx.closePath();ctx.fill();
    ctx.strokeStyle='rgba(223,211,167,.22)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-r.r*.48,-r.r*.53);ctx.lineTo(r.r*.27,-r.r*.78);ctx.stroke();ctx.restore();
  }
  function drawTree(t){
    const q=point(t.x,t.y);if(q.x<-55||q.x>innerWidth+55||q.y<-70||q.y>innerHeight+55)return;
    ctx.save();ctx.translate(q.x,q.y);ctx.fillStyle='rgba(20,33,25,.32)';ctx.beginPath();ctx.ellipse(6,10,t.r*1.2,t.r*.65,.2,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=t.kind==='pine'?'#514c39':'#65523b';ctx.fillRect(-3,-t.r*.55,6,t.r*.9);
    const greens=['#334f39','#3c5a3d','#496644','#526c45'];const c=greens[t.tone];
    if(t.kind==='pine'){ctx.fillStyle=c;for(let i=0;i<3;i++){ctx.beginPath();ctx.moveTo(0,-t.r*1.8+i*t.r*.48);ctx.lineTo(-t.r*.68,t.r*.05+i*t.r*.3);ctx.lineTo(t.r*.68,t.r*.05+i*t.r*.3);ctx.closePath();ctx.fill()}}
    else{ctx.fillStyle=c;ctx.beginPath();ctx.arc(-t.r*.27,-t.r*.45,t.r*.72,0,Math.PI*2);ctx.arc(t.r*.32,-t.r*.51,t.r*.69,0,Math.PI*2);ctx.arc(0,-t.r*.88,t.r*.72,0,Math.PI*2);ctx.fill();ctx.fillStyle='rgba(150,153,87,.16)';ctx.beginPath();ctx.arc(-t.r*.25,-t.r*1.05,t.r*.32,0,Math.PI*2);ctx.fill()}
    ctx.restore();
  }
  function drawFossil(f){
    const q=point(f.x,f.y),pulse=.82+Math.sin(time*3+f.phase)*.18;if(q.x<-45||q.x>innerWidth+45||q.y<-45||q.y>innerHeight+45)return;
    ctx.save();ctx.translate(q.x,q.y);ctx.globalAlpha=.6+pulse*.4;ctx.fillStyle='rgba(203,233,163,.16)';ctx.beginPath();ctx.arc(0,0,25*pulse,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#d5efae';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(0,0,12*pulse,0,Math.PI*2);ctx.stroke();
    ctx.rotate(time*.25+f.phase);ctx.fillStyle='#e2edbc';ctx.beginPath();ctx.moveTo(0,-8);ctx.lineTo(3,-2);ctx.lineTo(9,0);ctx.lineTo(3,3);ctx.lineTo(0,9);ctx.lineTo(-3,3);ctx.lineTo(-9,0);ctx.lineTo(-3,-2);ctx.closePath();ctx.fill();ctx.restore();
  }
  function drawCreature(a,isPlayer){
    const x=isPlayer?player.x:a.x,y=isPlayer?player.y:a.y,angle=isPlayer?player.angle:a.angle,size=isPlayer?17:a.size;
    const q=point(x,y);if(q.x<-60||q.x>innerWidth+60||q.y<-60||q.y>innerHeight+60)return;
    const data=isPlayer?classData[selected]:null;const mammal=isPlayer?selected==='mammal':['smilodon','mammoth'].includes(a.name);const bird=isPlayer?selected==='avian':['terror bird','pterosaur'].includes(a.name);const amphib=isPlayer?selected==='amphibian':['diplocaulus','eryops'].includes(a.name);
    const bodyColor=isPlayer?data.color:(a.kind==='pred'?(mammal?'#9b684d':'#78815a'):bird?'#a99669':'#8c8a61');
    ctx.save();ctx.translate(q.x,q.y);ctx.rotate(angle);ctx.fillStyle='rgba(19,31,24,.34)';ctx.beginPath();ctx.ellipse(1,size*.54,size*1.12,size*.52,0,0,Math.PI*2);ctx.fill();
    if(!isPlayer&&a.alert>0){ctx.strokeStyle='#e59a6b99';ctx.lineWidth=1;ctx.beginPath();ctx.arc(0,0,size+8,0,Math.PI*2);ctx.stroke()}
    // Legs and body silhouette.
    ctx.strokeStyle=bodyColor;ctx.lineWidth=Math.max(3,size*.24);ctx.lineCap='round';
    for(const lx of [-size*.35,size*.3])for(const ly of [-size*.43,size*.43]){ctx.beginPath();ctx.moveTo(lx,ly);ctx.lineTo(lx-size*.12,ly+size*.46);ctx.stroke()}
    ctx.fillStyle=bodyColor;ctx.beginPath();ctx.ellipse(0,0,size*.9,size*.56,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=isPlayer?data.accent:'#c3ae7b';ctx.globalAlpha=.75;ctx.beginPath();ctx.ellipse(size*.05,size*.04,size*.52,size*.27,0,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
    // Tail, wings or aquatic crest give each lineage a distinct silhouette.
    ctx.strokeStyle=bodyColor;ctx.lineWidth=Math.max(3,size*.22);ctx.beginPath();ctx.moveTo(-size*.65,0);ctx.quadraticCurveTo(-size*1.1,-size*.12,-size*1.38,size*.08);ctx.stroke();
    if(bird){ctx.fillStyle=bodyColor;ctx.beginPath();ctx.moveTo(-size*.35,-size*.1);ctx.quadraticCurveTo(-size*.15,-size*1.15,size*.48,-size*.17);ctx.quadraticCurveTo(size*.1,-size*.38,-size*.35,-size*.1);ctx.fill();ctx.beginPath();ctx.moveTo(-size*.35,size*.1);ctx.quadraticCurveTo(-size*.15,size*1.15,size*.48,size*.17);ctx.quadraticCurveTo(size*.1,size*.38,-size*.35,size*.1);ctx.fill()}
    if(amphib){ctx.fillStyle=bodyColor;ctx.beginPath();ctx.moveTo(size*.35,-size*.28);ctx.lineTo(size*.88,-size*.72);ctx.lineTo(size*.62,-size*.05);ctx.lineTo(size*.35,size*.28);ctx.lineTo(size*.88,size*.72);ctx.lineTo(size*.62,size*.05);ctx.closePath();ctx.fill()}
    ctx.fillStyle=bodyColor;ctx.beginPath();ctx.ellipse(size*.67,0,size*.39,size*.33,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#e9d59c';ctx.beginPath();ctx.arc(size*.83,-size*.12,Math.max(1.7,size*.075),0,Math.PI*2);ctx.fill();ctx.fillStyle='#273128';ctx.beginPath();ctx.arc(size*.85,-size*.12,Math.max(1,size*.035),0,Math.PI*2);ctx.fill();
    if(mammal||(!isPlayer&&a.kind==='pred')){ctx.fillStyle='#e8dfbc';ctx.beginPath();ctx.moveTo(size*.7,size*.2);ctx.lineTo(size*.83,size*.48);ctx.lineTo(size*.87,size*.18);ctx.fill()}
    if(isPlayer){ctx.strokeStyle='#f0edcf';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(0,0,size*1.32,-.8,.8);ctx.stroke()}
    ctx.restore();
    if(!isPlayer&&a.hp<a.maxHp){ctx.fillStyle='#20251f';ctx.fillRect(q.x-size*.65,q.y-size-10,size*1.3,3);ctx.fillStyle='#d77b5d';ctx.fillRect(q.x-size*.65,q.y-size-10,size*1.3*clamp(a.hp/a.maxHp,0,1),3)}
  }
  function render(){
    const w=innerWidth,h=innerHeight;
    ctx.clearRect(0,0,w,h);drawTerrain();
    const visible=[];
    for(const p of plants)visible.push([p.y,()=>drawPlant(p)]);
    for(const r of rocks)visible.push([r.y,()=>drawRock(r)]);
    for(const t of trees)visible.push([t.y,()=>drawTree(t)]);
    for(const f of fossils)if(f.active)visible.push([f.y,()=>drawFossil(f)]);
    for(const a of animals)visible.push([a.y,()=>drawCreature(a,false)]);
    if(player)visible.push([player.y,()=>drawCreature(null,true)]);
    visible.sort((a,b)=>a[0]-b[0]);for(const [,draw] of visible)draw();
    if(attackFX>0&&player){ctx.save();ctx.translate(player.x-camera.x,player.y-camera.y);ctx.rotate(player.angle);ctx.strokeStyle=`rgba(228,231,173,${attackFX*3})`;ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,47,-.72,.72);ctx.stroke();ctx.restore()}
    // atmospheric daylight and periodic storms
    const hour=worldTime;const night=hour<5.4||hour>19.2;ctx.fillStyle=night?'rgba(13,25,48,.42)':hour<7||hour>17?'rgba(204,133,78,.13)':'rgba(224,217,165,.025)';ctx.fillRect(0,0,w,h);
    if(currentEvent===1){ctx.fillStyle='rgba(102,145,151,.1)';ctx.fillRect(0,0,w,h);ctx.strokeStyle='#d9e8dc4c';ctx.lineWidth=1;for(let i=0;i<95;i++){const x=(i*113+time*125)%w,y=(i*67+time*260)%h;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-9,y+19);ctx.stroke()}}
    if(currentEvent===4){ctx.fillStyle='#9d7a5630';ctx.fillRect(0,0,w,h)}
    // update world clock and territory labels
    const hh=Math.floor(hour),mm=Math.floor((hour-hh)*60);$('time-label').textContent=`DAY ${String(Math.floor(time/150)+1).padStart(2,'0')} · ${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}`;
    if(player){$('map-coords').textContent=`${(68+player.y/H*7).toFixed(1)}° N · ${(24+player.x/W*9).toFixed(1)}° E`;const zone=player.x<W*.32?'RED CANYON':player.x>W*.68?'FERNHEART BASIN':player.y<H*.34?'GLACIAL EDGE':player.y>H*.68?'ANCIENT LOWLAND':'RIVERWILD';$('territory-label').textContent=zone}
    drawMinimap();
  }
  // Render the wilderness beneath the lineage selection screen.
  render();
})();
