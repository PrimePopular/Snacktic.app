/* Snacktic sound: all synthesized with Web Audio (no audio files needed) */
const S=(()=>{let ctx,mg,sg,nb=0,nt=0,tm,started=0;const on={m:1,s:1};
try{const j=JSON.parse(localStorage.getItem('snacktic-snd')||'{}');if(j.m===0)on.m=0;if(j.s===0)on.s=0}catch(e){}
const f=m=>440*2**((m-69)/12),B=60/92;
function init(){if(ctx)return;const A=window.AudioContext||window.webkitAudioContext;if(!A)return;ctx=new A();
 mg=ctx.createGain();sg=ctx.createGain();mg.gain.value=on.m?.22:0;sg.gain.value=on.s?.7:0;mg.connect(ctx.destination);sg.connect(ctx.destination)}
function n(d,fr,t,du,v,ty='sine',o={}){const os=ctx.createOscillator(),g=ctx.createGain(),a=o.a||.01;os.type=ty;os.frequency.setValueAtTime(fr,t);
 if(o.to)os.frequency.exponentialRampToValueAtTime(o.to,t+du);g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(v,t+a);
 g.gain.exponentialRampToValueAtTime(.0001,t+du);os.connect(g);g.connect(d);os.start(t);os.stop(t+du+.05)}
function nz(d,t,du,v,fr){const b=ctx.createBuffer(1,ctx.sampleRate*du|0,ctx.sampleRate),x=b.getChannelData(0);for(let i=0;i<x.length;i++)x[i]=Math.random()*2-1;
 const s=ctx.createBufferSource(),q=ctx.createBiquadFilter(),g=ctx.createGain();s.buffer=b;q.type='bandpass';q.frequency.value=fr;g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(.0001,t+du);s.connect(q);q.connect(g);g.connect(d);s.start(t)}
/* theme: cozy bakery loop, 8 bars, C - Am - F - G / C - Em - F - G */
const CH=[[48,52,55,59],[45,52,55,60],[41,48,52,57],[43,50,53,59],[48,52,55,59],[40,47,52,55],[41,48,52,57],[43,50,55,59]];
const ME=[[[0,76,1.5],[1.5,79,.5],[2,81,1],[3,79,1]],[[0,76,1],[1,74,1],[2,72,2]],[[0,72,1],[1,76,1],[2,79,1.5],[3.5,81,.5]],[[0,79,2],[2,76,1],[3,74,1]],
 [[0,76,1.5],[1.5,79,.5],[2,84,1.5],[3.5,81,.5]],[[0,79,1],[1,76,1],[2,74,1],[3,76,1]],[[0,72,1],[1,74,.5],[1.5,76,.5],[2,79,2]],[[0,74,2],[2,72,2]]];
const AR=[0,2,1,3,2,3,1,2];
function bar(i,t){const c=CH[i];c.forEach(m=>n(mg,f(m),t,4*B+.4,.03,'sine',{a:.5}));
 n(mg,f(c[0]-12),t,1.1,.14,'sine');n(mg,f(c[0]-12),t+2*B,1.1,.1,'sine');
 AR.forEach((x,k)=>{const q=t+k*B/2;n(mg,f(c[x]+12),q,.6,.06,'triangle');n(mg,f(c[x]+36),q,.1,.012);if(k%2)nz(mg,q,.05,.012,6000)});
 ME[i].forEach(([b,m,d])=>{n(mg,f(m),t+b*B,d*B+.5,.075,'sine',{a:.02});n(mg,f(m+12),t+b*B,.4,.012)})}
function tick(){while(nt<ctx.currentTime+.7){bar(nb%8,nt);nt+=4*B;nb++}}
document.addEventListener('visibilitychange',()=>{if(!ctx)return;document.hidden?ctx.suspend():ctx.resume()});
const x=fn=>(...a)=>{if(ctx&&on.s){ctx.resume();fn(ctx.currentTime,...a)}};
return{on,
 unlock(){init();if(ctx)ctx.resume()},
 start(){init();if(!ctx||started)return;started=1;nt=ctx.currentTime+.15;tick();tm=setInterval(tick,200)},
 toggle(k){init();on[k]=on[k]?0:1;if(ctx){(k=='m'?mg:sg).gain.setTargetAtTime(on[k]?(k=='m'?.22:.7):0,ctx.currentTime,.05)}
  try{localStorage.setItem('snacktic-snd',JSON.stringify(on))}catch(e){}return on[k]},
 click:x(t=>n(sg,700,t,.09,.12,'sine',{to:1100})),
 step:x((t,w)=>{const b=w?330:520;n(sg,b,t,.1,.14,'sine',{to:b*1.6});n(sg,b*.5,t+.27,.1,.16,'triangle',{to:b*.3});nz(sg,t+.27,.04,.05,900)}),
 wall:x((t,w)=>{n(sg,w?120:160,t+.2,.2,.3,'sine',{to:55});nz(sg,t+.2,.05,.25,1800);n(sg,w?330:440,t+.22,.25,.06,'triangle')}),
 bad:x(t=>{n(sg,220,t,.14,.1,'triangle');n(sg,185,t+.12,.2,.1,'triangle')}),
 win:x(t=>{[72,76,79,84,88].forEach((m,i)=>{n(sg,f(m),t+i*.11,.7,.13,'triangle');n(sg,f(m+12),t+i*.11,.3,.03)});[72,76,79,84].forEach(m=>n(sg,f(m),t+.6,1.4,.07,'sine',{a:.05}))}),
 lose:x(t=>{[67,64,62,60].forEach((m,i)=>{n(sg,f(m),t+i*.28,.8,.12,'sine',{a:.03});n(sg,f(m-12),t+i*.28,.8,.06)})})}})();
