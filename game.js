const suits = [
  { symbol: '♠', red: false },
  { symbol: '♥', red: true },
  { symbol: '♦', red: true },
  { symbol: '♣', red: false }
];
const ranks = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];

const dom = {
  bankroll: document.getElementById('bankroll'),
  playerStack: document.getElementById('player-stack'),
  pot: document.getElementById('pot'),
  status: document.getElementById('status'),
  betRange: document.getElementById('bet-range'),
  betAmountLabel: document.getElementById('bet-amount-label'),
  dealButton: document.getElementById('deal-btn'),
  checkButton: document.getElementById('check-btn'),
  raiseButton: document.getElementById('raise-btn'),
  foldButton: document.getElementById('fold-btn'),
  resetButton: document.getElementById('reset-btn'),
  startingChips: document.getElementById('starting-chips'),
  difficulty: document.getElementById('difficulty'),
  numPlayers: document.getElementById('num-players'),
  turnIndicator: document.getElementById('turn-indicator'),
  playerCards: document.getElementById('player-cards'),
  communityCards: document.getElementById('community-cards'),
  roundLog: document.getElementById('round-log')
};

const state = {
  players: [],
  deck: [],
  communityCards: [],
  pot: 0,
  actionHistory: [],
  currentStage: 'idle',
  dealerIndex: 0,
  currentPlayerIndex: 0,
  currentBet: 0,
  smallBlind: 10,
  bigBlind: 20,
  minimumRaise: 20,
  aiTimer: null,
  lastServerSnapshot: {}
};

function formatMoney(v){return v.toLocaleString('en-US');}
function getNextIndex(i,count=state.players.length){return (i+1)%count;}

function createDeck(){const deck=[]; for(const s of suits)for(const r of ranks)deck.push({rank:r,suit:s}); for(let i=deck.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[deck[i],deck[j]]=[deck[j],deck[i]]} return deck;}
function cardToString(c){return `${c.rank}${c.suit.symbol}`}
function appendLog(text){state.actionHistory.push(text); if(state.actionHistory.length>80) state.actionHistory.shift(); renderHistory();}
function renderHistory(){ dom.roundLog.innerHTML=''; state.actionHistory.slice().reverse().forEach(line=>{ const el=document.createElement('div'); el.className='log-line'; el.textContent=line; dom.roundLog.appendChild(el); }); }

function renderCard(card,reveal=true){const el=document.createElement('span');el.className='card'+(card&&card.suit&&card.suit.red?' red':'');el.textContent=reveal&&card?cardToString(card):'★';if(!reveal)el.classList.add('back');return el;}
function renderPlaceholder(){const el=document.createElement('span');el.className='card placeholder';el.textContent='?';return el;}
function renderCommunityCards(){dom.communityCards.innerHTML='';if(state.communityCards.length===0){for(let i=0;i<5;i++)dom.communityCards.appendChild(renderPlaceholder());return}state.communityCards.forEach(c=>dom.communityCards.appendChild(renderCard(c,true)));}

function renderSeatCards(player){if(!player)return;const cardsElId=player.isHuman?'player-cards':`${player.seatId}-cards`;const cardsEl=document.getElementById(cardsElId);if(!cardsEl)return;cardsEl.innerHTML='';if(state.currentStage==='idle'&&!player.isHuman){cardsEl.appendChild(renderCard({rank:'X',suit:{symbol:'★',red:false}},false));cardsEl.appendChild(renderCard({rank:'X',suit:{symbol:'★',red:false}},false));return}const reveal=state.currentStage==='showdown'||player.isHuman||player.showCards;if(!player.hand.length){cardsEl.appendChild(renderPlaceholder());cardsEl.appendChild(renderPlaceholder());return}player.hand.forEach(card=>cardsEl.appendChild(renderCard(card,reveal)));if(player.hand.length===1)cardsEl.appendChild(renderPlaceholder());}

function renderPlayerSeats(){state.players.forEach(player=>{const nameEl=document.getElementById(`${player.seatId}-name`);const stackEl=document.getElementById(`${player.seatId}-stack`);if(nameEl)nameEl.innerHTML=`${player.name}${player.isHuman?' <span class="you-tag">PLAYER</span>':''}`;if(stackEl)stackEl.textContent=formatMoney(player.stack);renderSeatCards(player);});for(let i=1;i<=8;i++){const seatEl=document.getElementById(`ai-seat-${i}`);if(seatEl){const exists=state.players.some(p=>p.seatId===`ai-${i}`);seatEl.style.display=exists?'block':'none';}}const humanSeat=document.getElementById('human-seat');if(humanSeat)humanSeat.style.display='flex';dom.bankroll.textContent=formatMoney(state.players[0].stack);}

function createPlayers(){const numSeats=Math.max(2,Math.min(9,Number(dom.numPlayers.value||4)));const aiCount=numSeats-1;state.players=[];state.players.push({id:'human',name:'YOU',isHuman:true,seatId:'human',stack:Number(dom.startingChips.value),hand:[],folded:false,allIn:false,isDealer:false,isSmallBlind:false,isBigBlind:false,roundContribution:0,hasActedThisRound:false,showCards:true,lastAction:'Waiting',status:'Ready'});for(let i=1;i<=aiCount;i++){state.players.push({id:`ai${i}`,name:`AI ${i}`,isHuman:false,seatId:`ai-${i}`,stack:Math.floor(Number(dom.startingChips.value)*0.2),hand:[],folded:false,allIn:false,isDealer:false,isSmallBlind:false,isBigBlind:false,roundContribution:0,hasActedThisRound:false,showCards:false,lastAction:'Waiting',status:'Ready'});}}

function setStatus(m){dom.status.textContent=m;}
function updateBetControls(){const human=state.players[0];const toCall=Math.max(0,state.currentBet-human.roundContribution);const rangeMin=Math.max(20,state.currentBet+20);dom.betRange.min=String(rangeMin);dom.betRange.max=String(Math.max(rangeMin,human.stack));dom.betRange.value=String(Math.max(rangeMin,state.currentBet+20));dom.betAmountLabel.textContent=`$${Number(dom.betRange.value).toLocaleString()}`;dom.checkButton.textContent=toCall>0?`Call $${formatMoney(toCall)}`:'Check';dom.raiseButton.textContent=toCall>0?`Raise to $${formatMoney(Number(dom.betRange.value))}`:`Bet $${formatMoney(Number(dom.betRange.value))}`;}
function setTurnIndicator(m){dom.turnIndicator.textContent=m;}

function dealBlinds(){if(state.players.length<2)return;const sbIndex=getNextIndex(state.dealerIndex);const bbIndex=getNextIndex(sbIndex);state.players.forEach(p=>{p.isSmallBlind=false;p.isBigBlind=false;});state.players[sbIndex].isSmallBlind=true;state.players[bbIndex].isBigBlind=true;const sb=Math.min(state.smallBlind,state.players[sbIndex].stack);state.players[sbIndex].stack-=sb;state.players[sbIndex].roundContribution=sb;state.pot+=sb;const bb=Math.min(state.bigBlind,state.players[bbIndex].stack);state.players[bbIndex].stack-=bb;state.players[bbIndex].roundContribution=bb;state.pot+=bb;state.currentBet=bb;state.currentPlayerIndex=getNextIndex(bbIndex);appendLog(`${state.players[sbIndex].name} posts small blind ${formatMoney(sb)}`);appendLog(`${state.players[bbIndex].name} posts big blind ${formatMoney(bb)}`);setTurnIndicator(`${state.players[state.currentPlayerIndex].name}'s turn`);}

function beginHand(){if(state.aiTimer)clearTimeout(state.aiTimer);state.deck=createDeck();state.communityCards=[];state.actionHistory=[];state.pot=0;state.currentStage='preflop';state.currentBet=0;state.players.forEach(player=>{player.hand=[];player.folded=false;player.allIn=false;player.status='Ready';player.isDealer=false;player.isSmallBlind=false;player.isBigBlind=false;player.roundContribution=0;player.hasActedThisRound=false;player.showCards=false;player.lastAction='Waiting';});state.dealerIndex=(state.dealerIndex+1)%state.players.length;state.players[state.dealerIndex].isDealer=true;for(let i=0;i<2;i++)state.players.forEach(player=>player.hand.push(state.deck.pop()));dealBlinds();renderCommunityCards();renderPlayerSeats();updateBetControls();state.players.forEach(player=>{if(player.isHuman)player.showCards=true;});appendLog(`Dealer: ${state.players[state.dealerIndex].name}`);if(state.players[state.currentPlayerIndex].isHuman){setStatus('Your turn. Call, raise, or fold.');enableHumanControls();}else{setStatus('AI players are acting.');disableHumanControls();scheduleAiAction();}updateServerSnapshot();}

function updatePot(){dom.pot.textContent=formatMoney(state.pot);}
function updateBankroll(){dom.bankroll.textContent=formatMoney(state.players[0].stack);dom.playerStack.textContent=formatMoney(state.players[0].stack);}

function isRoundComplete(){const active=state.players.filter(p=>!p.folded&&!p.allIn);if(active.length<=1)return true;const maxContribution=Math.max(...state.players.filter(p=>!p.folded).map(p=>p.roundContribution||0));return state.players.filter(p=>!p.folded).every(p=>p.hasActedThisRound && p.roundContribution===maxContribution);}

function advanceTurn(){const active=state.players.filter(p=>!p.folded&&!p.allIn);if(active.length===1){finishHand();return;}let attempts=0;while(attempts<state.players.length){state.currentPlayerIndex=getNextIndex(state.currentPlayerIndex);const player=state.players[state.currentPlayerIndex];attempts++;if(!player.folded&&!player.allIn&&!player.hasActedThisRound){if(player.isHuman){setStatus('Your turn. Call, raise, or fold.');enableHumanControls();}else{setStatus(`${player.name} is thinking...`);disableHumanControls();scheduleAiAction();}setTurnIndicator(`${player.name}'s turn`);return;}}if(isRoundComplete())resolveStreet();}

function finishHand(){const remaining = state.players.filter(p=>!p.folded);if(remaining.length<=1){const winner=remaining[0]||state.players.reduce((best,p)=>best.stack>p.stack?best:p);winner.stack+=state.pot;appendLog(`${winner.name} wins pot ${formatMoney(state.pot)}`);setStatus(`${winner.name} wins the pot of ${formatMoney(state.pot)}.`);} else { 
  const showdown = state.players.filter(p=>!p.folded).map(p=>({player:p,rank:evaluatePlayer(p,state.communityCards)})).sort((a,b)=>compareHands(b.rank,a.rank));
  const winners = showdown.filter(x => compareHands(x.rank,showdown[0].rank)===0);
  const prize = Math.floor(state.pot / winners.length);
  const remainder = state.pot % winners.length;
  winners.forEach((entry, index) => { entry.player.stack += prize + (index===0 ? remainder : 0); appendLog(`${entry.player.name} wins ${formatMoney(prize + (index===0?remainder:0))} from showdown.`); });
  const winnerNames = winners.map(x=>x.player.name).join(', ');
  setStatus(`${winnerNames} win the pot of ${formatMoney(state.pot)}.`);
}
state.players.forEach(p=>p.showCards=true);renderCommunityCards();renderPlayerSeats();updateBankroll();updatePot();state.currentStage='showdown';renderCommunityCards();updateServerSnapshot();disableHumanControls();}

function resolveStreet(){if(state.currentStage==='preflop'){state.currentStage='flop';state.communityCards.push(state.deck.pop(),state.deck.pop(),state.deck.pop());state.players.forEach(p=>{p.roundContribution=0;p.hasActedThisRound=false;});state.currentBet=0;state.currentPlayerIndex=state.dealerIndex;appendLog(`Flop: ${state.communityCards.map(cardToString).join(' ')}`);setStatus('Flop dealt');}
  else if(state.currentStage==='flop'){state.currentStage='turn';state.communityCards.push(state.deck.pop());state.players.forEach(p=>{p.roundContribution=0;p.hasActedThisRound=false;});state.currentBet=0;state.currentPlayerIndex=state.dealerIndex;appendLog(`Turn: ${state.communityCards.map(cardToString).join(' ')}`);setStatus('Turn dealt');}
  else if(state.currentStage==='turn'){state.currentStage='river';state.communityCards.push(state.deck.pop());state.players.forEach(p=>{p.roundContribution=0;p.hasActedThisRound=false;});state.currentBet=0;state.currentPlayerIndex=state.dealerIndex;appendLog(`River: ${state.communityCards.map(cardToString).join(' ')}`);setStatus('River dealt');}
  else if(state.currentStage==='river'){finishHand();return;}
  renderCommunityCards();updateServerSnapshot();advanceTurn();}

function enableHumanControls(){const human=state.players[0];const toCall=Math.max(0,state.currentBet-human.roundContribution);dom.checkButton.disabled=false;dom.raiseButton.disabled=false;dom.foldButton.disabled=false;dom.checkButton.textContent=toCall>0?`Call $${formatMoney(toCall)}`:'Check';dom.raiseButton.textContent=toCall>0?`Raise to $${formatMoney(Number(dom.betRange.value))}`:`Bet $${formatMoney(Number(dom.betRange.value))}`;}
function disableHumanControls(){dom.checkButton.disabled=true;dom.raiseButton.disabled=true;dom.foldButton.disabled=true;}

function scheduleAiAction(){if(state.aiTimer)clearTimeout(state.aiTimer);const player=state.players[state.currentPlayerIndex];state.aiTimer=setTimeout(()=>{if(state.currentStage==='idle')return;const act=decideAiAction(player);performAction(player,act.action,act.amount);},700+Math.random()*700);}

function handleHumanAction(action){if(state.currentStage==='idle')return;const human=state.players[0];if(state.currentPlayerIndex!==0||human.folded||human.allIn)return;if(action==='fold'){performAction(human,'fold');return;}if(action==='check'){const toCall=Math.max(0,state.currentBet-human.roundContribution);if(toCall>0)performAction(human,'call');else performAction(human,'check');return;}const betValue=Number(dom.betRange.value);performAction(human,'raise',betValue);}

function performAction(player,action,amount=0){if(!player||player.folded||player.allIn)return;if(player.isHuman&&state.currentPlayerIndex!==0)return;if(!player.isHuman&&state.currentPlayerIndex!==state.players.indexOf(player))return;const toCall=Math.max(0,state.currentBet-player.roundContribution);if(action==='fold'){player.folded=true;player.hasActedThisRound=true;player.lastAction='Fold';player.status='Folded';appendLog(`${player.name} folds.`);setStatus(`${player.name} folds.`);if(player.isHuman)disableHumanControls();advanceTurn();updateServerSnapshot();return;}if(action==='check'){if(toCall>0) action='call'; else { player.hasActedThisRound=true; player.lastAction='Check'; player.status='Checked'; appendLog(`${player.name} checks.`); setStatus(`${player.name} checks.`); if(player.isHuman)disableHumanControls(); advanceTurn(); updateServerSnapshot(); return; } }if(action==='call'){const callAmount=Math.min(player.stack,toCall);if(callAmount<=0){player.allIn=true;player.status='All-in';player.lastAction='All-in';appendLog(`${player.name} is all-in.`);setStatus(`${player.name} is all-in.`);player.hasActedThisRound=true;if(player.isHuman)disableHumanControls();advanceTurn();return;}player.stack-=callAmount;state.pot+=callAmount;player.roundContribution+=callAmount;player.hasActedThisRound=true;player.lastAction='Call';player.status='Called';appendLog(`${player.name} calls ${formatMoney(callAmount)}.`);if(player.stack===0){player.allIn=true;player.status='All-in';appendLog(`${player.name} is all-in.`);}if(player.isHuman)disableHumanControls();updatePot();updateBankroll();updateServerSnapshot();if(isRoundComplete())resolveStreet();else advanceTurn();return;}if(action==='raise'||action==='bet'){const totalBet=Math.max(Number(amount)||0,state.currentBet+state.minimumRaise);const totalContribution=Math.max(player.roundContribution+1,totalBet);const delta=totalContribution-player.roundContribution;if(delta<=0)return;const actualContribution=Math.min(delta,player.stack);player.stack-=actualContribution;state.pot+=actualContribution;player.roundContribution+=actualContribution;state.currentBet=Math.max(state.currentBet,player.roundContribution);player.hasActedThisRound=true;player.lastAction=action==='raise'?'Raise':'Bet';player.status=action==='raise'?'Raised':'Bet';appendLog(`${player.name} ${action==='raise'?'raises':'bets'} to ${formatMoney(player.roundContribution)}.`);if(player.stack===0){player.allIn=true;player.status='All-in';appendLog(`${player.name} is all-in.`);}if(player.isHuman)disableHumanControls();updatePot();updateBankroll();updateServerSnapshot();if(isRoundComplete())resolveStreet();else advanceTurn();}}

function decideAiAction(player){const toCall=Math.max(0,state.currentBet-player.roundContribution);const board=state.communityCards;const strength=evaluateBestHand(player.hand.concat(board));const rankValue=strength.category;const potOdds = toCall>0 ? (toCall / (state.pot + toCall)) : 0;let action='check';let amount=0;if(toCall>0){if(rankValue>=7 || (state.currentStage==='preflop' && rankValue>=6)){action='raise';amount=Math.min(player.stack, state.currentBet + Math.max(40, Math.floor(player.stack*0.2)));} else if(rankValue>=4){action = (potOdds < 0.4 || rankValue>=6) ? 'call' : (Math.random()<0.6 ? 'call' : 'fold');} else {action = Math.random() < Math.max(0.05, 0.35 - potOdds*0.5) ? 'call' : 'fold';}}else{if((state.currentStage==='preflop' && rankValue>=6) || rankValue>=8){action='raise';amount=Math.min(player.stack, state.currentBet + (state.bigBlind * 2));} else if(rankValue>=4 && Math.random()<0.7){action='bet';amount=Math.min(player.stack, state.currentBet + 30);} else {action='check';}}return {action, amount};}

function evaluateBestHand(cards){if(cards.length<5)return{category:0,value:[0]};const combos=[];for(let i=0;i<cards.length-4;i++)for(let j=i+1;j<cards.length-3;j++)for(let k=j+1;k<cards.length-2;k++)for(let l=k+1;l<cards.length-1;l++)for(let m=l+1;m<cards.length;m++)combos.push([cards[i],cards[j],cards[k],cards[l],cards[m]]);return combos.map(evaluateHand).sort((a,b)=>compareHands(b,a)).slice(0,1)[0]||{category:0,value:[0]};}
function evaluateHand(cards){const values=cards.map(c=>convertRank(c.rank));const suitsArr=cards.map(c=>c.suit.symbol);values.sort((a,b)=>a-b);const countsMap={};values.forEach(v=>countsMap[v]=(countsMap[v]||0)+1);const frequency=Object.values(countsMap).sort((a,b)=>b-a);const sortedRanks=Object.keys(countsMap).map(Number).sort((a,b)=>b-a);const isFlush=[...new Set(suitsArr)].length===1;const isStraight=isSequential(values);if(isStraight&&isFlush&&values[4]===14)return{category:9,value:[14]};if(isStraight&&isFlush)return{category:8,value:[values[4]]};if(frequency[0]===4)return{category:7,value:[sortedRanks[0],sortedRanks[1]]};if(frequency[0]===3&&frequency[1]===2)return{category:6,value:[sortedRanks[0],sortedRanks[1]]};if(isFlush)return{category:5,value:[...values].reverse()};if(isStraight)return{category:4,value:[values[4]]};if(frequency[0]===3)return{category:3,value:[sortedRanks[0],...sortedRanks.slice(1).reverse()]};if(frequency[0]===2&&frequency[1]===2)return{category:2,value:[sortedRanks[0],sortedRanks[1],...sortedRanks.slice(2).reverse()]};if(frequency[0]===2)return{category:1,value:[sortedRanks[0],...sortDesc(values.filter(v=>v!==sortedRanks[0]))]};return{category:0,value:[...values].reverse()};}
function compareHands(a,b){if(a.category!==b.category)return a.category-b.category;for(let i=0;i<Math.max(a.value.length,b.value.length);i++){const av=a.value[i]||0;const bv=b.value[i]||0;if(av!==bv)return av-bv;}return 0;}
function evaluatePlayer(player,boardCards){return evaluateBestHand(player.hand.concat(boardCards));}
function isSequential(values){const arr=[...new Set(values)].sort((a,b)=>a-b);if(arr.length!==5)return false;if(arr[0]===10&&arr[1]===11&&arr[2]===12&&arr[3]===13&&arr[4]===14)return true;for(let i=1;i<arr.length;i++)if(arr[i]!==arr[i-1]+1)return false;return true;}
function convertRank(rank){const m={'2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14};return m[rank];}
function sortDesc(vals){return vals.slice().sort((a,b)=>b-a);}

function updateServerSnapshot(){state.lastServerSnapshot={stage:state.currentStage,pot:state.pot,currentBet:state.currentBet,communityCards:state.communityCards.map(cardToString),players:state.players.map(p=>({id:p.id,name:p.name,stack:p.stack,folded:p.folded,allIn:p.allIn,status:p.status,hand:p.hand.map(cardToString)}))};window.pokerServerHooks={getGameSnapshot:()=>({...state.lastServerSnapshot}),executeAction:(playerName,action,amount)=>{const player=state.players.find(e=>e.name===playerName||e.id===playerName);if(!player)return false;performAction(player,action,amount);return true;},startNewHand:()=>beginHand(),getVersion:()=> 'server-ready-v1'};}

function resetTable(){state.currentStage='idle';state.pot=0;state.currentBet=0;state.communityCards=[];state.actionHistory=[];state.players=[];createPlayers();renderCommunityCards();renderPlayerSeats();updatePot();updateBankroll();setTurnIndicator('Waiting for deal');setStatus('Welcome! Start a hand and watch the AI table react.');disableHumanControls();renderHistory();updateServerSnapshot();}

function handleRangeUpdate(){const value=Number(dom.betRange.value);dom.betAmountLabel.textContent=`$${value.toLocaleString()}`;if(state.players[0]&&state.players[0].isHuman){dom.raiseButton.textContent=state.currentBet>0?`Raise to $${value.toLocaleString()}`:`Bet $${value.toLocaleString()}`;}}

function bindEvents(){dom.dealButton.addEventListener('click',beginHand);dom.checkButton.addEventListener('click',()=>handleHumanAction('check'));dom.raiseButton.addEventListener('click',()=>handleHumanAction('raise'));dom.foldButton.addEventListener('click',()=>handleHumanAction('fold'));dom.resetButton.addEventListener('click',()=>{const chips=Number(dom.startingChips.value);state.players[0].stack=chips;resetTable();setStatus(`Practice chips reset to ${formatMoney(chips)}. Choose Deal New Hand when ready.`);});dom.startingChips.addEventListener('change',()=>{const chips=Number(dom.startingChips.value);if(state.players.length&&state.currentStage!=='idle'){state.players[0].stack=chips;renderPlayerSeats();updateBankroll();}});dom.betRange.addEventListener('input',handleRangeUpdate);dom.numPlayers.addEventListener('change',()=>resetTable());}

window.addEventListener('load',()=>{createPlayers();bindEvents();resetTable();updateBetControls();updateServerSnapshot();});
window.pokerServerHooks={getGameSnapshot:()=>({stage:state.currentStage,pot:state.pot,currentBet:state.currentBet,players:[]}),executeAction:()=>false,startNewHand:()=>beginHand(),getVersion:()=> 'server-ready-v1'};
