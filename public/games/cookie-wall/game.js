const P=46,D=[[1,0],[-1,0],[0,1],[0,-1]],NAMES=['Crumb','Nibbler','Snacker','Gourmet','Cookie Monster'];
const rnd=(()=>{let a=777;return()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return(t^t>>>14)|0}})();
const Z=n=>Array.from({length:n},()=>[rnd(),rnd()]);
const ZP=[Z(81),Z(81)],ZH=Z(64),ZV=Z(64),ZT=[rnd(),rnd()];
const key=s=>(s.a&0x1FFFFF)*4294967296+(s.b>>>0);
function newState(){const s={p:[[7,4],[1,4]],H:new Uint8Array(64),V:new Uint8Array(64),w:[10,10],t:0,a:0,b:0};
 for(let i=0;i<2;i++){const z=ZP[i][s.p[i][0]*9+s.p[i][1]];s.a^=z[0];s.b^=z[1]}return s}
const hw=(s,r,c)=>r>=0&&r<8&&c>=0&&c<8&&s.H[r*8+c],vw=(s,r,c)=>r>=0&&r<8&&c>=0&&c<8&&s.V[r*8+c];
function blk(s,r,c,dr,dc){if(dr==1)return hw(s,r,c)||hw(s,r,c-1);if(dr==-1)return hw(s,r-1,c)||hw(s,r-1,c-1);
 if(dc==1)return vw(s,r,c)||vw(s,r-1,c);return vw(s,r,c-1)||vw(s,r-1,c-1)}
const inb=(r,c)=>r>=0&&r<9&&c>=0&&c<9;
function pm(s,i){const [r,c]=s.p[i],[or,oc]=s.p[1-i],out=[];
 for(const [dr,dc] of D){if(blk(s,r,c,dr,dc))continue;const nr=r+dr,nc=c+dc;if(!inb(nr,nc))continue;
  if(nr==or&&nc==oc){const jr=nr+dr,jc=nc+dc;
   if(inb(jr,jc)&&!blk(s,nr,nc,dr,dc))out.push([jr,jc]);
   else for(const [er,ec] of D){if(er*dr+ec*dc!=0||blk(s,nr,nc,er,ec))continue;const xr=nr+er,xc=nc+ec;if(inb(xr,xc))out.push([xr,xc])}
  }else out.push([nr,nc])}
 return out}
function bfs(s,i,path){const g=i?8:0,st=s.p[i][0]*9+s.p[i][1],pv=new Int8Array(81).fill(-2),dist=new Int8Array(81),q=[st];pv[st]=-1;
 for(let h=0;h<q.length;h++){const x=q[h],r=x/9|0,c=x%9;
  if(r==g){if(!path)return dist[x];const a=[];for(let y=x;y>=0;y=pv[y])a.push(y);return a.reverse()}
  for(const [dr,dc] of D){if(blk(s,r,c,dr,dc))continue;const nr=r+dr,nc=c+dc;if(!inb(nr,nc))continue;const y=nr*9+nc;
   if(pv[y]==-2){pv[y]=x;dist[y]=dist[x]+1;q.push(y)}}}
 return path?null:99}
function wallOk(s,o,r,c){if(r<0||r>7||c<0||c>7)return false;const T=o?s.V:s.H,X=o?s.H:s.V,k=r*8+c;
 if(T[k]||X[k])return false;
 if(o){if(r>0&&T[k-8])return false;if(r<7&&T[k+8])return false}else{if(c>0&&T[k-1])return false;if(c<7&&T[k+1])return false}
 T[k]=1;const ok=bfs(s,0)<99&&bfs(s,1)<99;T[k]=0;return ok}
function ap(s,m){const t=s.t,u=[s.a,s.b,s.p[t][0],s.p[t][1]];
 if(m.w){const k=m.r*8+m.c,z=(m.o?ZV:ZH)[k];(m.o?s.V:s.H)[k]=t+1;s.w[t]--;s.a^=z[0];s.b^=z[1]}
 else{const o=ZP[t][u[2]*9+u[3]],n=ZP[t][m.r*9+m.c];s.a^=o[0]^n[0];s.b^=o[1]^n[1];s.p[t]=[m.r,m.c]}
 s.t=1-t;s.a^=ZT[0];s.b^=ZT[1];return u}
function un(s,m,u){s.t=1-s.t;const t=s.t;if(m.w){(m.o?s.V:s.H)[m.r*8+m.c]=0;s.w[t]++}else s.p[t]=[u[2],u[3]];s.a=u[0];s.b=u[1]}
function gen(s,pawnOnly){const t=s.t,ms=[],pth=bfs(s,t,1),nx=pth&&pth[1];
 for(const [r,c] of pm(s,t))ms.push({w:0,r,c,sc:r*9+c==nx?1:0});
 ms.sort((a,b)=>b.sc-a.sc);
 if(pawnOnly||s.w[t]<1)return ms;
 const pp=bfs(s,1-t,1),seen=new Set();
 for(let i=0;i+1<pp.length;i++){const a=pp[i],b=pp[i+1],ar=a/9|0,ac=a%9,br=b/9|0,bc=b%9;let cs;
  if(br!=ar){const r0=Math.min(ar,br);cs=[[0,r0,ac],[0,r0,ac-1]]}else{const c0=Math.min(ac,bc);cs=[[1,ar,c0],[1,ar-1,c0]]}
  for(const [o,r,c] of cs){const k=o*100+r*8+c;if(seen.has(k))continue;seen.add(k);if(wallOk(s,o,r,c))ms.push({w:1,o,r,c})}}
 return ms}
let LV=1,nodes=0,T0=0,TL=0,stop=false,learn=new Map;
const ev=s=>12*(bfs(s,0)-bfs(s,1))+3*(s.w[1]-s.w[0])+(s.t?2:-2);
function ab(s,d,al,be){
 if(s.p[1][0]==8)return 1e5+d;if(s.p[0][0]==0)return -1e5-d;
 if(LV==5){const pen=learn.get(key(s));if(pen)return -pen}
 if(d==0)return ev(s);
 if((++nodes&255)==0&&performance.now()-T0>TL)stop=true;if(stop)return 0;
 const ms=gen(s);let b;
 if(s.t){b=-1e9;for(const m of ms){const u=ap(s,m),v=ab(s,d-1,al,be);un(s,m,u);if(v>b)b=v;if(b>al)al=b;if(al>=be||stop)break}}
 else{b=1e9;for(const m of ms){const u=ap(s,m),v=ab(s,d-1,al,be);un(s,m,u);if(v<b)b=v;if(b<be)be=b;if(al>=be||stop)break}}
 return b}
function think(s,lv){LV=lv;const all=gen(s),pw=all.filter(m=>!m.w),ws=all.filter(m=>m.w),pick=a=>a[Math.random()*a.length|0];
 if(lv==1){if(Math.random()<.5||!ws.length)return Math.random()<.55?pick(pw):pw[0];return Math.random()<.07?pick(ws):pw[0]}
 if(lv==2){if(ws.length&&bfs(s,0)<=bfs(s,1)&&Math.random()<.22)return pick(ws);return Math.random()<.1?pick(pw):pw[0]}
 if(Math.random()<[0,0,0,.1,.07,.03][lv])return pick(pw);
 const maxD=lv==3?2:lv==4?3:7;TL=lv==3?500:lv==4?800:1700;T0=performance.now();stop=false;nodes=0;
 let ms=all.slice(),best=ms[0];
 for(let d=1;d<=maxD;d++){let bm=null,bv=-1e9;
  for(const m of ms){const u=ap(s,m);let v=ab(s,d-1,bv,1e9);un(s,m,u);if(stop)break;if(lv<5)v+=Math.random()*3;if(v>bv){bv=v;bm=m}}
  if(stop||!bm)break;best=bm;ms=[bm,...ms.filter(x=>x!==bm)];if(bv>9e4)break}
 return best}

/* ---------- UI (Snacktic phone-frame theme) ---------- */
const C={choc:'#35231F',cream:'#FFF8EF',orange:'#FF8A3D',rose:'#E96B73',pistachio:'#B8C99A',char:'#242220'};
const LOAD_TOTAL_MS=4700,LOAD_SPEED=1.5;
  // Cookie + notification logo mark
  function cookieSVG() {
    const chips = [[38, 52, 4], [60, 45, 3.5], [45, 78, 4.5], [68, 70, 4], [30, 72, 3], [62, 92, 3.5], [80, 84, 3]]
      .map(function (c) { return '<circle cx="' + c[0] + '" cy="' + c[1] + '" r="' + c[2] + '" fill="#1F130F"/>'; })
      .join('');
    return '<svg viewBox="0 0 130 124" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Snacktic cookie">' +
      '<defs><mask id="snBite"><rect width="130" height="124" fill="#fff"/><circle cx="92" cy="38" r="23" fill="#000"/></mask></defs>' +
      '<ellipse cx="52" cy="117" rx="30" ry="4" fill="' + C.orange + '" opacity="0.28"/>' +
      '<g mask="url(#snBite)">' +
        '<circle cx="52" cy="68" r="44" fill="' + C.choc + '"/>' +
        '<path d="M20 52 A38 38 0 0 1 52 28" stroke="#5A3A31" stroke-width="4" fill="none" stroke-linecap="round"/>' +
        chips +
      '</g>' +
      '<circle cx="88" cy="36" r="12" fill="' + C.orange + '"/>' +
      '<text x="88" y="41.5" text-anchor="middle" font-family="Space Grotesk, system-ui, sans-serif" font-weight="700" font-size="15" fill="' + C.cream + '">1</text>' +
      '<g stroke="' + C.orange + '" stroke-width="4" stroke-linecap="round">' +
        '<line x1="98" y1="18" x2="101" y2="9"/><line x1="106" y1="25" x2="114" y2="19"/><line x1="108" y1="35" x2="117" y2="35"/>' +
      '</g></svg>';
  }

  // Logo animation shown while the game loads
  function loadingHTML() {
    const letters = 'Snacktic'.split('').map(function (ch, i) {
      return '<span class="sn-ld-letter' + (i === 7 ? ' orange' : '') + '">' + ch + '</span>';
    }).join('');

    return `
      <span class="sn-blob sn-ld-top"></span>
      <span class="sn-blob sn-ld-bottom"></span>
      <span class="sn-blob sn-spark a"></span>
      <span class="sn-blob sn-spark b"></span>
      <span class="sn-blob sn-spark c"></span>

      <p class="sn-ld-eyebrow">A little something good is coming</p>

      <div class="sn-ld-logo" aria-hidden="true">
        <span class="sn-ld-shadow"></span>
        <svg class="sn-ld-cookie" viewBox="0 0 200 200">
          <defs>
            <radialGradient id="snLdCookieGrad" cx="35%" cy="28%" r="78%">
              <stop offset="0%" stop-color="#9b5735"/>
              <stop offset="48%" stop-color="#71351f"/>
              <stop offset="100%" stop-color="#3a1d16"/>
            </radialGradient>
            <linearGradient id="snLdChipGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#2a1511"/>
              <stop offset="100%" stop-color="#160c0a"/>
            </linearGradient>
            <mask id="snLdBite">
              <rect width="200" height="200" fill="white"/>
              <circle class="sn-ld-bite" cx="145" cy="43" r="31" fill="black"/>
            </mask>
          </defs>

          <g class="sn-ld-body">
            <g mask="url(#snLdBite)">
              <circle cx="91" cy="104" r="72" fill="url(#snLdCookieGrad)" stroke="#3b1d15" stroke-width="4"/>
              <path d="M40 65c15-24 49-38 75-28" fill="none" stroke="#bd8057" stroke-width="5" stroke-linecap="round" opacity=".25"/>
              <g fill="url(#snLdChipGrad)">
                <ellipse cx="55" cy="75" rx="8" ry="10" transform="rotate(22 55 75)"/>
                <ellipse cx="91" cy="58" rx="7" ry="9" transform="rotate(-18 91 58)"/>
                <ellipse cx="119" cy="91" rx="9" ry="11" transform="rotate(28 119 91)"/>
                <ellipse cx="69" cy="119" rx="9" ry="11" transform="rotate(-24 69 119)"/>
                <ellipse cx="111" cy="139" rx="7" ry="9" transform="rotate(18 111 139)"/>
                <ellipse cx="145" cy="119" rx="6" ry="8" transform="rotate(-15 145 119)"/>
                <ellipse cx="43" cy="103" rx="5" ry="7"/>
                <ellipse cx="92" cy="101" rx="5" ry="6"/>
              </g>
              <g fill="#d59a6e" opacity=".23">
                <circle cx="49" cy="91" r="2.5"/><circle cx="104" cy="45" r="2"/>
                <circle cx="130" cy="126" r="2.5"/><circle cx="80" cy="151" r="2"/>
                <circle cx="135" cy="70" r="2"/>
              </g>
            </g>
          </g>

          <g class="sn-ld-crumb" style="--dx:-27px;--dy:25px" fill="#a85d35"><circle cx="29" cy="143" r="4"/></g>
          <g class="sn-ld-crumb c2" style="--dx:24px;--dy:30px" fill="#d28a50"><circle cx="157" cy="147" r="3.5"/></g>
          <g class="sn-ld-crumb c3" style="--dx:-20px;--dy:-22px" fill="#7d3e25"><circle cx="34" cy="44" r="3"/></g>

          <g class="sn-ld-badge">
            <circle cx="148" cy="42" r="19" fill="#f36f2b"/>
            <circle cx="148" cy="42" r="15.5" fill="#ff8a3d"/>
            <text x="148" y="49" text-anchor="middle" fill="#fffaf4"
                  font-family="Space Grotesk, sans-serif" font-size="21" font-weight="700">1</text>
          </g>
          <g class="sn-ld-rays" fill="none" stroke="#ff8a3d" stroke-width="5.5" stroke-linecap="round">
            <path d="M177 16l8-10"/>
            <path d="M184 39l13-2"/>
            <path d="M177 61l10 7"/>
          </g>
        </svg>
      </div>

      <div class="sn-ld-word" role="img" aria-label="Snacktic">${letters}</div>
      <p class="sn-ld-tag">Good snacks, <strong>good moments.</strong></p>
      <div class="sn-ld-loader" aria-hidden="true"><span class="sn-ld-fill"></span></div>`;
  }


let G={s:newState(),over:true,hist:[]},level=3,mode='m',flip=0,ghost=null,busy=false,lastPos=null,lastW=null;
const $=id=>document.getElementById(id),SK='snacktic-brain-v1';let rec=[0,0];
try{const j=JSON.parse(localStorage.getItem(SK)||'{}');if(j.l)learn=new Map(j.l);if(j.r)rec=j.r}catch(e){}
function save(){try{localStorage.setItem(SK,JSON.stringify({l:[...learn].slice(-6000),r:rec}))}catch(e){}}
function buzz(p){try{if(window.AndroidApp){AndroidApp.vibrate(Array.isArray(p)?p.reduce((a,b)=>a+b,0):p);return}navigator.vibrate&&navigator.vibrate(p)}catch(e){}}
let set={assist:true,suggest:true},prog={assist:0,pts:0,wins:0,cool:0},pending=null;
try{Object.assign(set,JSON.parse(localStorage.getItem('snacktic-set')||'{}'));Object.assign(prog,JSON.parse(localStorage.getItem('snacktic-prog')||'{}'))}catch(e){}
const saveP=()=>{try{localStorage.setItem('snacktic-set',JSON.stringify(set));localStorage.setItem('snacktic-prog',JSON.stringify(prog))}catch(e){}};
/* Snacktic: inside the app the level is fixed and the game never quietly makes itself easier. */
const SNACK=new URLSearchParams(location.search),EMBED=window.parent!==window&&SNACK.get('embed')==='1';
function report(m){if(!EMBED)return;try{window.parent.postMessage(Object.assign({source:'snacktic-game',game:'cookie-wall'},m),location.origin)}catch(e){}}
if(EMBED){set.assist=false;set.suggest=false;prog.assist=0}
let startedAt=Date.now();
const LINES={w:['Not so fast!','Walls are my favorite snack.','Take a detour, friend.','Om nom nom… blocked!'],m:['Just a quick stroll…','Smell that? Victory crumbs.','Tick tock!','Catch me if you can!']};
function confetti(){const o=$('s-over');for(let i=0;i<26;i++){const s=document.createElement('span');s.className='sn-conf';s.textContent=['🍪','✨','🍓','⭐','🍫'][i%5];s.style.cssText=`left:${Math.random()*92}%;animation-duration:${2+Math.random()*1.8}s;animation-delay:${Math.random()*.5}s`;o.appendChild(s);setTimeout(()=>s.remove(),4200)}}
const helped=()=>set.assist?prog.assist:0,eff=()=>Math.max(1,level-helped());
function newGame(){startedAt=Date.now();G={s:newState(),over:false,hist:[],lv:eff()};if(level-helped()<1)G.s.w[1]=8;G.hist.push(key(G.s));ghost=null;busy=false;lastPos=null;lastW=null;mode='m';render()}
function setStatus(t,th){$('st').textContent=t;$('bdg').className='badge'+(th?' think':'')}
function render(){const s=G.s;let h='';
 for(let r=0;r<9;r++)for(let c=0;c<9;c++){const f=r==0?'#F6C9C6':r==8?'#DDE6CA':'#F3E1C7';
  h+=`<rect class="cell" data-r="${r}" data-c="${c}" x="${c*P}" y="${r*P}" width="36" height="36" rx="9" fill="${f}"/>`}
 const mine=!G.over&&s.t==0&&!busy;
 if(mine&&mode=='m')for(const [r,c] of pm(s,0))h+=`<circle data-r="${r}" data-c="${c}" class="cell hint" cx="${c*P+18}" cy="${r*P+18}" r="8" fill="#FF8A3D"/>`;
 const cur=new Set();for(let k=0;k<64;k++){if(s.H[k])cur.add('h'+k);if(s.V[k])cur.add('v'+k)}
 const nw=id=>lastW&&!lastW.has(id)?' wnew':'';
 for(let k=0;k<64;k++){const r=k>>3,c=k&7;
  if(s.H[k])h+=`<rect class="wall${nw('h'+k)}" x="${c*P}" y="${r*P+38}" width="82" height="6" rx="3" fill="${s.H[k]==1?'#E96B73':'#B8C99A'}"/>`;
  if(s.V[k])h+=`<rect class="wall${nw('v'+k)}" x="${c*P+38}" y="${r*P}" width="6" height="82" rx="3" fill="${s.V[k]==1?'#E96B73':'#B8C99A'}"/>`}
 if(ghost){const{o,r,c,ok}=ghost;h+=o?`<rect x="${c*P+38}" y="${r*P}" width="6" height="82" rx="3" fill="${ok?'#FF8A3D':'#888'}" opacity=".85"/>`:`<rect x="${c*P}" y="${r*P+38}" width="82" height="6" rx="3" fill="${ok?'#FF8A3D':'#888'}" opacity=".85"/>`}
 h+=`<circle id="pawn0" class="pawn" cx="${s.p[0][1]*P+18}" cy="${s.p[0][0]*P+18}" r="13" fill="#E96B73" stroke="#FFF8EF" stroke-width="3"/><circle id="pawn1" class="pawn" cx="${s.p[1][1]*P+18}" cy="${s.p[1][0]*P+18}" r="13" fill="#B8C99A" stroke="#35231F" stroke-width="3"/>`;
 h+='<rect id="gh" rx="3" opacity="0" pointer-events="none"/>';
 $('bd').innerHTML=h;
 /* movement animation: hop from old square to new square */
 const rm=matchMedia('(prefers-reduced-motion:reduce)').matches;
 if(lastPos&&!rm)for(let i=0;i<2;i++){const a=lastPos[i],b=s.p[i];
  if(a[0]!=b[0]||a[1]!=b[1]){const dx=(a[1]-b[1])*P,dy=(a[0]-b[0])*P;
   $('pawn'+i).animate([{transform:`translate(${dx}px,${dy}px) scale(1)`},{transform:`translate(${dx/2}px,${dy/2}px) scale(1.35)`,offset:.5},
    {transform:'translate(0,0) scale(.92,1.08)',offset:.85},{transform:'translate(0,0) scale(1)'}],{duration:340,easing:'ease-in-out'})}}
 lastPos=[s.p[0].slice(),s.p[1].slice()];lastW=cur;
 for(let i=0;i<2;i++)$('pw'+i).innerHTML=Array.from({length:10},(_,k)=>`<i style="background:${i?'#B8C99A':'#E96B73'};opacity:${k<s.w[i]?1:.2}"></i>`).join('');
 $('aiN').textContent=NAMES[level-1]+(helped()?' · easier':'');
 if(!G.over&&!busy)setStatus('Your move – tap an orange dot to step, or tap a gap between squares to build a wall.');
}
function after(){const s=G.s;G.hist.push(key(s));
 if(s.p[0][0]==0)return end(0);if(s.p[1][0]==8)return end(1);
 if(s.t==1)busy=true;render();if(s.t==1){setStatus(NAMES[level-1]+' is thinking…',1);setTimeout(ai,420)}}
function ai(){if(G.over)return;const m=think(G.s,G.lv);ap(G.s,m);m.w?S.wall(1):S.step(1);busy=false;ghost=null;after();if(!G.over&&Math.random()<.4)setStatus(NAMES[level-1]+': “'+pick2(m.w?LINES.w:LINES.m)+'”')}
const pick2=a=>a[Math.random()*a.length|0];

function end(w){G.over=true;busy=false;render();report({type:'finish',level:level,won:w==0,seconds:Math.round((Date.now()-startedAt)/1000)});const name=NAMES[level-1],real=G.lv==5;let t,p,e,note='',offer=null;
 if(prog.cool>0)prog.cool--;
 if(w==0){e='🍪';t='You win!';p='Sweet victory over '+name+'.';prog.pts=0;prog.wins++;
  if(real){rec[0]++;const n=Math.min(G.hist.length-1,26);for(let i=G.hist.length-1-n;i<G.hist.length;i++)learn.set(G.hist[i],5000);
   e='🏆';t='You beat Cookie Monster!';p='It’s memorizing exactly how you did that, so it won’t fall for the same trick twice.';save()}
  if(set.suggest&&prog.wins>=2&&prog.cool<=0){
   if(helped()>0)offer={q:'You’re on a roll! Want the help turned down? '+name+' would play a bit harder.',yes:()=>{prog.assist--}};
   else if(level<5)offer={q:'You’re on a roll! Ready to try '+NAMES[level]+'?',yes:()=>{level++;prog.assist=0}}}}
 else{e='😈';t='Snacked!';p=real?'Cookie Monster outsmarted you this time… and it never forgets a trick.':name+' got there first! Try again.';prog.wins=0;
  if(real){rec[1]++;save()}
  const d=bfs(G.s,0);prog.pts+=d<=2?.67:d>=5?1.5:1;   /* close loss counts less, a crushing loss counts more */
  if(set.assist&&prog.pts>=1.99&&prog.assist<Math.min(2,level)){prog.assist++;prog.pts=0;note='Going a little easier on you next game.'}}
 pending=offer;saveP();
 $('note').style.display=note?'':'none';$('note').textContent=note;$('offer').style.display=offer?'block':'none';if(offer)$('offerq').textContent=offer.q;
 setStatus(w==0?'You win!':name+' wins.');$('ot').textContent=t;$('op').textContent=p;$('oe').textContent=e;
 if(w==1){$('gm').classList.add('shake');setTimeout(()=>$('gm').classList.remove('shake'),500)}
 setTimeout(()=>{if(G.over){showScreen('over');if(w==0){S.win();buzz([60,40,60,40,120]);confetti()}else S.lose()}},650)}
const svg=$('bd');
function toUnits(e){const p=svg.createSVGPoint();p.x=e.clientX;p.y=e.clientY;const q=p.matrixTransform(svg.getScreenCTM().inverse());return[q.x,q.y]}
/* which wall (if any) sits under the pointer: the gap lines between squares */
function gapAt(x,y){const gy=Math.round((y-41)/P),gx=Math.round((x-41)/P),dy=Math.abs(y-(41+gy*P)),dx=Math.abs(x-(41+gx*P));
 const ny=gy>=0&&gy<=7&&dy<=8,nx=gx>=0&&gx<=7&&dx<=8;if(ny==nx)return null;
 if(ny){const col=Math.min(8,Math.max(0,Math.floor(x/P))),wc=Math.min(7,Math.max(0,x-col*P<23?col-1:col));return{o:0,r:gy,c:wc}}
 const row=Math.min(8,Math.max(0,Math.floor(y/P))),wr=Math.min(7,Math.max(0,y-row*P<23?row-1:row));return{o:1,r:wr,c:gx}}
svg.onpointermove=e=>{const g=$('gh');if(!g)return;
 if(e.pointerType!='mouse'||G.over||busy||G.s.t||G.s.w[0]<1){g.setAttribute('opacity',0);return}
 const[x,y]=toUnits(e),w=gapAt(x,y);if(!w){g.setAttribute('opacity',0);return}
 const ok=wallOk(G.s,w.o,w.r,w.c);g.setAttribute('x',w.o?w.c*P+38:w.c*P);g.setAttribute('y',w.o?w.r*P:w.r*P+38);
 g.setAttribute('width',w.o?6:82);g.setAttribute('height',w.o?82:6);g.setAttribute('fill',ok?'#FF8A3D':'#888');g.setAttribute('opacity',.75)};
svg.onpointerleave=()=>{const g=$('gh');if(g)g.setAttribute('opacity',0)};
svg.onclick=e=>{if(G.over||busy||G.s.t)return;const[x,y]=toUnits(e),w=gapAt(x,y);
 if(w){if(G.s.w[0]<1){S.bad();buzz([20,40,20]);setStatus('No walls left – move instead.');return}
  if(!wallOk(G.s,w.o,w.r,w.c)){S.bad();buzz([20,40,20]);setStatus('Can’t build there – it overlaps a wall or seals a path.');return}
  ap(G.s,{w:1,...w});S.wall(0);buzz(30);return after()}
 const d=e.target.dataset;if(d.r!=null){const r=+d.r,c=+d.c;if(pm(G.s,0).some(a=>a[0]==r&&a[1]==c)){ap(G.s,{w:0,r,c});S.step(0);buzz(15);after()}}};

/* ---- screens: home -> level -> loading logo -> game ---- */
const DESC=['Wanders around and rarely blocks you.','Takes the shortest path, drops the odd wall.','Thinks 2 moves ahead. Solid casual opponent.','Thinks 3 moves ahead. Plays walls with purpose.','Impossible mode. Learns from every loss.'];
const screens={};['loading','home','level','help','set','over'].forEach(k=>screens[k]=$('s-'+k));
let loading=false,loadTimer=0,helpFrom='home',setFrom='home';
function syncSnd(){$('bmu').classList.toggle('off',!S.on.m);$('bfx').classList.toggle('off',!S.on.s);document.querySelectorAll('[data-tg]').forEach(b=>{const k=b.dataset.tg;b.classList.toggle('on',k=='m'?!!S.on.m:k=='s'?!!S.on.s:!!set[k])});const on=S.on.m||S.on.s;document.querySelectorAll('[data-snd]').forEach(b=>b.textContent='Sound: '+(on?'On':'Off'))}
function showScreen(n){for(const k in screens)screens[k].classList.toggle('sn-show',k===n);$('ctl').classList.toggle('sn-show',n===null);
 if(n=='home')$('rec').textContent='Vs Cookie Monster: you '+rec[0]+' – '+rec[1]}
function drawLevels(){$('lvls').innerHTML=NAMES.map((n,i)=>`<button class="sn-step sn-lv${i+1==level?' on':''}" data-l="${i+1}"><div class="sn-num">${i+1}</div><div><b>${n}</b><span>${DESC[i]}</span></div></button>`).join('')}
function runLoading(done){loading=true;G.over=true;screens.loading.innerHTML=loadingHTML();
 if(screens.loading.getAnimations)screens.loading.getAnimations({subtree:true}).forEach(a=>a.playbackRate=LOAD_SPEED);
 showScreen('loading');const rm=matchMedia('(prefers-reduced-motion:reduce)').matches;clearTimeout(loadTimer);
 loadTimer=setTimeout(()=>{loading=false;done()},rm?600:LOAD_TOTAL_MS/LOAD_SPEED)}
const startGame=()=>{S.start();runLoading(()=>{showScreen(null);newGame()})};
$('wrap').addEventListener('pointerdown',()=>S.unlock(),{once:true});
$('wrap').addEventListener('click',e=>{if(loading)return;
 const l=e.target.closest('[data-l]');if(l){const nl=+l.dataset.l;if(nl!=level){prog.assist=0;prog.pts=0;prog.wins=0;saveP()}level=nl;S.click();drawLevels();return}
 const tg=e.target.closest('[data-tg]');if(tg){const k=tg.dataset.tg;S.click();if(k=='m'||k=='s')S.toggle(k);else{set[k]=!set[k];saveP()}syncSnd();return}
 const b=e.target.closest('[data-act]');if(!b)return;const a=b.dataset.act;S.click();
 if(EMBED){if(a=='home'||a=='back'||a=='levels'){G.over=true;report({type:'exit'});return}if(level>3&&(a=='restart'||a=='again'||a=='go'))return}
 if(a=='play'){drawLevels();showScreen('level')}
 else if(a=='help'){helpFrom=screens.level.classList.contains('sn-show')?'level':'home';showScreen('help')}
 else if(a=='helpdone')showScreen(helpFrom);
 else if(a=='go'||a=='again'||a=='restart')startGame();
 else if(a=='levels'){G.over=true;drawLevels();showScreen('level')}
 else if(a=='home'||a=='back'){G.over=true;showScreen('home')}
 else if(a=='settings'){setFrom=screens.level.classList.contains('sn-show')?'level':'home';syncSnd();showScreen('set')}
 else if(a=='setdone')showScreen(setFrom)
 else if(a=='yes'&&pending){pending.yes();pending=null;prog.wins=0;prog.pts=0;saveP();$('offer').style.display='none';$('note').style.display='';$('note').textContent='Next game: '+NAMES[level-1]+(helped()?' (with a little help)':'')}
 else if(a=='no'){prog.cool=3;prog.wins=0;pending=null;saveP();$('offer').style.display='none'}
 else if(a=='mu'){S.toggle('m');syncSnd()}
 else if(a=='fx'){S.toggle('s');syncSnd()}
 else if(a=='snd'){const on=S.on.m||S.on.s;if(S.on.m==on)S.toggle('m');if(S.on.s==on)S.toggle('s');syncSnd()}});
syncSnd();if(EMBED){level=Math.min(5,Math.max(1,+SNACK.get('level')||1));startGame()}else showScreen('home');
/* ---- phone-app bits: install button, offline cache ---- */
/* Snacktic: the app registers its own service worker, so this game does not. */
