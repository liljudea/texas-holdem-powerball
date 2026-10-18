const suits = [
  { symbol: '♠', red: false },
  { symbol: '♥', red: true },
  { symbol: '♦', red: true },
  { symbol: '♣', red: false }
];

const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

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
  minimumRaise: 20,
  aiTimer: null,
  handNumber: 0
};

function formatMoney(value) {
  return Number(value).toLocaleString('en-US');
}

function cardToString(card) {
  return `${card.rank}${card.suit.symbol}`;
}

function appendLog(line) {
  state.actionHistory.push(line);
  if (state.actionHistory.length > 75) state.actionHistory.shift();
  renderHistory();
}

function renderHistory() {
  dom.roundLog.innerHTML = '';
  state.actionHistory.slice().reverse().forEach((line) => {
    const entry = document.createElement('div');
    entry.className = 'log-line';
    entry.textContent = line;
    dom.roundLog.appendChild(entry);
  });
}

function renderCard(card, reveal = true) {
  const el = document.createElement('span');
  el.className = 'card' + (card && card.suit && card.suit.red ? ' red' : '');
  el.textContent = reveal && card ? `${card.rank}${card.suit.symbol}` : '★';
  return el;
}

function renderPlaceholder() {
  const el = document.createElement('span');
  el.className = 'card placeholder';
  el.textContent = '?';
  return el;
}

function renderCommunityCards() {
  dom.communityCards.innerHTML = '';
  if (state.communityCards.length === 0) {
    for (let i = 0; i < 5; i += 1) {
      dom.communityCards.appendChild(renderPlaceholder());
    }
    return;
  }

  state.communityCards.forEach((card) => {
    dom.communityCards.appendChild(renderCard(card, true));
  });
}

function renderPlayerSeats() {
  const seatIds = ['ai-seat-1', 'ai-seat-2', 'ai-seat-3', 'ai-seat-4', 'ai-seat-5', 'ai-seat-6', 'ai-seat-7', 'ai-seat-8'];
  const activeSeats = new Set(state.players.filter((player) => !player.isHuman).map((player) => player.seatContainerId));

  seatIds.forEach((seatId) => {
    const seat = document.getElementById(seatId);
    if (seat) {
      seat.style.display = activeSeats.has(seatId) ? 'block' : 'none';
    }
  });

  for (const player of state.players) {
    const stackEl = player.isHuman ? document.getElementById('player-stack') : document.getElementById(`${player.seatId}-stack`);
    const nameEl = player.isHuman ? document.getElementById('human-name') : document.getElementById(`${player.seatId}-name`);

    if (stackEl) stackEl.textContent = formatMoney(player.stack);
    if (nameEl) nameEl.textContent = player.name;

    const cardsEl = player.isHuman ? dom.playerCards : document.getElementById(`${player.seatId}-cards`);
    if (!cardsEl) continue;

    cardsEl.innerHTML = '';
    if (state.currentStage === 'idle' || player.folded) {
      cardsEl.appendChild(renderPlaceholder());
      cardsEl.appendChild(renderPlaceholder());
      continue;
    }

    if (!player.hand || player.hand.length === 0) {
      cardsEl.appendChild(renderPlaceholder());
      cardsEl.appendChild(renderPlaceholder());
      continue;
    }

    const showCards = player.isHuman || state.currentStage === 'showdown';
    cardsEl.appendChild(renderCard(player.hand[0], showCards));
    cardsEl.appendChild(renderCard(player.hand[1], showCards));
  }

  if (state.players[0]) {
    dom.bankroll.textContent = formatMoney(state.players[0].stack);
    dom.playerStack.textContent = formatMoney(state.players[0].stack);
  }
}

function setStatus(message) {
  dom.status.textContent = message;
}

function updatePotDisplay() {
  dom.pot.textContent = formatMoney(state.pot);
}

function getNextIndex(index, count = state.players.length) {
  return (index + 1) % count;
}

function createDeck() {
  const deck = [];
  suits.forEach((suit) => {
    ranks.forEach((rank) => {
      deck.push({ rank, suit });
    });
  });

  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  return deck;
}

function createPlayers() {
  const seatCount = Math.max(2, Math.min(9, Number(dom.numPlayers.value || 4)));
  const humanStack = Number(dom.startingChips.value || 10000);

  state.players = [{
    id: 'human',
    name: 'YOU',
    isHuman: true,
    seatId: 'human',
    seatContainerId: 'human-seat',
    stack: humanStack,
    hand: [],
    folded: false,
    allIn: false,
    roundContribution: 0,
    totalContribution: 0,
    hasActedThisRound: false
  }];

  for (let i = 1; i < seatCount; i += 1) {
    state.players.push({
      id: `ai-${i}`,
      name: `AI Player ${i}`,
      isHuman: false,
      seatId: `ai-${i}`,
      seatContainerId: `ai-seat-${i}`,
      stack: 2000,
      hand: [],
      folded: false,
      allIn: false,
      roundContribution: 0,
      totalContribution: 0,
      hasActedThisRound: false
    });
  }

  renderPlayerSeats();
}

function resetTable() {
  if (state.aiTimer) {
    clearTimeout(state.aiTimer);
    state.aiTimer = null;
  }

  state.currentStage = 'idle';
  state.currentBet = 0;
  state.pot = 0;
  state.communityCards = [];
  state.actionHistory = [];
  state.currentPlayerIndex = 0;

  createPlayers();
  state.players.forEach((player) => {
    player.hand = [];
    player.folded = false;
    player.allIn = false;
    player.roundContribution = 0;
    player.totalContribution = 0;
    player.hasActedThisRound = false;
  });

  renderCommunityCards();
  renderPlayerSeats();
  updatePotDisplay();
  renderHistory();
  disableHumanControls();
  dom.checkButton.textContent = 'Check / Call';
  dom.raiseButton.textContent = 'Bet / Raise';
  setStatus('Welcome! Start a hand and watch the AI table react.');
  dom.turnIndicator.textContent = 'Waiting for deal';
}

function updateBetAmountLabel() {
  const value = Number(dom.betRange.value || 20);
  dom.betAmountLabel.textContent = `$${formatMoney(value)}`;
}

function updateBetControls() {
  const human = state.players[0] || { stack: Number(dom.startingChips.value || 10000), roundContribution: 0 };
  const toCall = Math.max(0, state.currentBet - human.roundContribution);
  const suggested = Math.max(20, state.currentBet + state.minimumRaise);

  dom.betRange.min = '20';
  dom.betRange.max = String(Math.max(200, Math.min(1000, human.stack)));

  if (toCall > 0) {
    dom.betRange.min = String(Math.max(20, toCall + state.minimumRaise));
  }

  dom.betRange.value = String(Math.max(Number(dom.betRange.min), Math.min(Number(dom.betRange.max), Number(dom.betRange.value || suggested))));
  updateBetAmountLabel();
}

function enableHumanControls() {
  const human = state.players[0];
  const toCall = Math.max(0, state.currentBet - human.roundContribution);
  dom.checkButton.disabled = false;
  dom.raiseButton.disabled = false;
  dom.foldButton.disabled = false;
  dom.checkButton.textContent = toCall > 0 ? 'Call' : 'Check';
  dom.raiseButton.textContent = `Bet / Raise $${formatMoney(Number(dom.betRange.value || 20))}`;
  updateBetControls();
}

function disableHumanControls() {
  dom.checkButton.disabled = true;
  dom.raiseButton.disabled = true;
  dom.foldButton.disabled = true;
}

function setTurnIndicator(text) {
  dom.turnIndicator.textContent = text;
}

function getFirstActivePlayerAfter(index) {
  const count = state.players.length;
  for (let offset = 1; offset <= count; offset += 1) {
    const candidate = (index + offset) % count;
    if (!state.players[candidate].folded && !state.players[candidate].allIn) {
      return candidate;
    }
  }
  return index;
}

function isStreetComplete() {
  const activePlayers = state.players.filter((player) => !player.folded && !player.allIn);
  if (activePlayers.length <= 1) return true;

  const highestBet = Math.max(...activePlayers.map((player) => player.roundContribution));
  return activePlayers.every((player) => player.hasActedThisRound && player.roundContribution >= highestBet);
}

function advanceTurn() {
  if (isStreetComplete()) {
    revealNextStreet();
    return;
  }

  let nextIndex = state.currentPlayerIndex;
  for (let offset = 1; offset <= state.players.length; offset += 1) {
    nextIndex = (nextIndex + 1) % state.players.length;
    const player = state.players[nextIndex];
    if (!player.folded && !player.allIn) {
      state.currentPlayerIndex = nextIndex;
      break;
    }
  }

  const nextPlayer = state.players[state.currentPlayerIndex];
  if (!nextPlayer || nextPlayer.folded || nextPlayer.allIn) {
    revealNextStreet();
    return;
  }

  if (nextPlayer.isHuman) {
    setTurnIndicator('Your turn');
    enableHumanControls();
  } else {
    setTurnIndicator(`${nextPlayer.name} to act`);
    disableHumanControls();
    scheduleAiAction();
  }
}

function postBlind(player, amount) {
  if (!player || amount <= 0) return;
  const bet = Math.min(amount, player.stack);
  player.stack -= bet;
  player.roundContribution += bet;
  player.totalContribution += bet;
  state.pot += bet;
  state.currentBet = Math.max(state.currentBet, player.roundContribution);
  player.hasActedThisRound = true;
  if (player.stack <= 0) {
    player.allIn = true;
  }
}

function prepareTurn() {
  const active = state.players.filter((player) => !player.folded && !player.allIn);
  if (active.length <= 1) {
    finishHand();
    return;
  }

  const current = state.players[state.currentPlayerIndex];
  if (!current || current.folded || current.allIn) {
    advanceTurn();
    return;
  }

  if (current.isHuman) {
    setTurnIndicator('Your turn');
    enableHumanControls();
  } else {
    setTurnIndicator(`${current.name} to act`);
    disableHumanControls();
    scheduleAiAction();
  }
}

function revealNextStreet() {
  if (state.currentStage === 'preflop') {
    state.currentStage = 'flop';
    state.communityCards.push(state.deck.pop(), state.deck.pop(), state.deck.pop());
    appendLog(`Flop: ${state.communityCards.map(cardToString).join(' ')}`);
    setStatus('Flop dealt. Bet or check to continue.');
  } else if (state.currentStage === 'flop') {
    state.currentStage = 'turn';
    state.communityCards.push(state.deck.pop());
    appendLog(`Turn: ${cardToString(state.communityCards[state.communityCards.length - 1])}`);
    setStatus('Turn card dealt. One more chance to act.');
  } else if (state.currentStage === 'turn') {
    state.currentStage = 'river';
    state.communityCards.push(state.deck.pop());
    appendLog(`River: ${cardToString(state.communityCards[state.communityCards.length - 1])}`);
    setStatus('River dealt. Final betting round is live.');
  } else if (state.currentStage === 'river') {
    finishHand();
    return;
  }

  state.players.forEach((player) => {
    player.roundContribution = 0;
    player.hasActedThisRound = false;
  });
  state.currentBet = 0;

  renderCommunityCards();
  renderPlayerSeats();
  prepareTurn();
}

function applyAction(player, action, amount = 0) {
  if (!player || player.folded || player.allIn || state.currentStage === 'idle') {
    return;
  }

  const toCall = Math.max(0, state.currentBet - player.roundContribution);

  if (action === 'fold') {
    player.folded = true;
    player.hasActedThisRound = true;
    appendLog(`${player.name} folds.`);
    setStatus(`${player.name} folds.`);
    advanceTurn();
    return;
  }

  if (action === 'check') {
    if (toCall > 0) {
      applyAction(player, 'call');
      return;
    }
    player.hasActedThisRound = true;
    appendLog(`${player.name} checks.`);
    setStatus(`${player.name} checks.`);
    advanceTurn();
    return;
  }

  if (action === 'call') {
    if (toCall <= 0) {
      applyAction(player, 'check');
      return;
    }

    const callAmount = Math.min(toCall, player.stack);
    player.stack -= callAmount;
    player.roundContribution += callAmount;
    player.totalContribution += callAmount;
    state.pot += callAmount;
    player.hasActedThisRound = true;
    if (player.roundContribution > state.currentBet) state.currentBet = player.roundContribution;
    if (player.stack <= 0) player.allIn = true;

    appendLog(`${player.name} calls ${formatMoney(callAmount)}.`);
    setStatus(`${player.name} calls.`);
    advanceTurn();
    return;
  }

  if (action === 'raise') {
    const desired = Number(amount || dom.betRange.value || 20);
    const totalContribution = Math.max(state.currentBet + state.minimumRaise, desired);
    const delta = totalContribution - player.roundContribution;
    const actualRaise = Math.min(delta, player.stack);

    if (actualRaise <= 0) {
      applyAction(player, 'call');
      return;
    }

    player.stack -= actualRaise;
    player.roundContribution += actualRaise;
    player.totalContribution += actualRaise;
    state.pot += actualRaise;
    state.currentBet = Math.max(state.currentBet, player.roundContribution);
    player.hasActedThisRound = true;
    if (player.stack <= 0) player.allIn = true;

    appendLog(`${player.name} raises to ${formatMoney(player.roundContribution)}.`);
    setStatus(`${player.name} raises to ${formatMoney(player.roundContribution)}.`);
    advanceTurn();
  }
}

function handleHumanAction(action, providedAmount) {
  if (state.currentStage === 'idle') return;
  const human = state.players[0];
  if (!human || state.currentPlayerIndex !== 0 || human.folded || human.allIn) return;

  if (action === 'fold') {
    applyAction(human, 'fold');
    return;
  }
  if (action === 'check') {
    applyAction(human, 'check');
    return;
  }
  if (action === 'call') {
    applyAction(human, 'call');
    return;
  }
  if (action === 'raise') {
    applyAction(human, 'raise', Number(providedAmount ?? dom.betRange.value ?? 20));
  }
}

function convertRank(rank) {
  const map = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, J: 11, Q: 12, K: 13, A: 14 };
  return map[rank];
}

function isStraight(values) {
  const unique = [...new Set(values)].sort((a, b) => a - b);
  if (unique.length < 5) return false;

  if (unique.includes(14) && unique.includes(5) && unique.includes(4) && unique.includes(3) && unique.includes(2)) {
    return true;
  }

  for (let i = 0; i <= unique.length - 5; i += 1) {
    const slice = unique.slice(i, i + 5);
    if (slice[4] - slice[0] === 4 && new Set(slice).size === 5) {
      return true;
    }
  }

  return false;
}

function straightHigh(values) {
  const unique = [...new Set(values)].sort((a, b) => a - b);
  if (unique.includes(14) && unique.includes(5) && unique.includes(4) && unique.includes(3) && unique.includes(2)) {
    return 5;
  }

  for (let i = 0; i <= unique.length - 5; i += 1) {
    const slice = unique.slice(i, i + 5);
    if (slice[4] - slice[0] === 4 && new Set(slice).size === 5) {
      return slice[4];
    }
  }

  return 0;
}

function evaluateHand(cards) {
  if (cards.length < 5) {
    return { category: -1, value: [0] };
  }

  const values = cards.map((card) => convertRank(card.rank)).sort((a, b) => b - a);
  const suits = cards.map((card) => card.suit.symbol);
  const counts = {};

  values.forEach((value) => {
    counts[value] = (counts[value] || 0) + 1;
  });

  const countList = Object.values(counts).sort((a, b) => b - a);
  const rankList = Object.keys(counts).map(Number).sort((a, b) => b - a);
  const flush = suits.every((suit) => suit === suits[0]);
  const straight = isStraight(values);

  if (straight && flush) return { category: 8, value: [straightHigh(values)] };
  if (countList[0] === 4) {
    const quad = rankList[0];
    const kicker = rankList.find((rank) => rank !== quad);
    return { category: 7, value: [quad, kicker || 0] };
  }
  if (countList[0] === 3 && countList[1] === 2) {
    const trip = rankList[0];
    const pair = rankList.filter((rank) => rank !== trip)[0];
    return { category: 6, value: [trip, pair] };
  }
  if (flush) return { category: 5, value: values.slice(0, 5) };
  if (straight) return { category: 4, value: [straightHigh(values)] };
  if (countList[0] === 3) {
    const trip = rankList[0];
    const kickers = values.filter((rank) => rank !== trip).sort((a, b) => b - a);
    return { category: 3, value: [trip, ...kickers.slice(0, 2)] };
  }
  if (countList[0] === 2 && countList[1] === 2) {
    const pairs = rankList.slice().sort((a, b) => b - a);
    const kicker = values.find((rank) => !pairs.includes(rank));
    return { category: 2, value: [pairs[0], pairs[1], kicker || 0] };
  }
  if (countList[0] === 2) {
    const pair = rankList[0];
    const kickers = values.filter((rank) => rank !== pair).sort((a, b) => b - a);
    return { category: 1, value: [pair, ...kickers.slice(0, 3)] };
  }

  return { category: 0, value: values.slice(0, 5) };
}

function compareHands(a, b) {
  if (!a || !b) return 0;
  if (a.category !== b.category) return a.category - b.category;

  for (let i = 0; i < Math.max(a.value.length, b.value.length); i += 1) {
    const av = a.value[i] || 0;
    const bv = b.value[i] || 0;
    if (av !== bv) return av - bv;
  }

  return 0;
}

function bestFiveCards(cards) {
  if (cards.length <= 5) return evaluateHand(cards);

  let best = null;
  for (let i = 0; i < cards.length - 4; i += 1) {
    for (let j = i + 1; j < cards.length - 3; j += 1) {
      for (let k = j + 1; k < cards.length - 2; k += 1) {
        for (let l = k + 1; l < cards.length - 1; l += 1) {
          for (let m = l + 1; m < cards.length; m += 1) {
            const combo = [cards[i], cards[j], cards[k], cards[l], cards[m]];
            const score = evaluateHand(combo);
            if (!best || compareHands(score, best) > 0) best = score;
          }
        }
      }
    }
  }

  return best || evaluateHand(cards.slice(0, 5));
}

function getHandLabel(result) {
  const names = ['High Card', 'One Pair', 'Two Pair', 'Three of a Kind', 'Straight', 'Flush', 'Full House', 'Four of a Kind', 'Straight Flush'];
  const category = Math.max(0, result.category || 0);
  const label = names[category] || 'High Card';
  const highlight = result.value && result.value.length ? result.value[0] : 0;
  if (highlight > 0 && category <= 5) {
    return `${label} (${highlight})`;
  }
  return label;
}

function evaluatePlayer(player, boardCards) {
  const combined = [...player.hand, ...boardCards];
  return bestFiveCards(combined);
}

function distributePots() {
  const contributors = state.players.map((p) => ({ player: p, contrib: p.totalContribution }));
  const negative = contributors.filter((c) => c.contrib < 0);
  if (negative.length > 0) {
    contributors.forEach((c) => {
      c.contrib = Math.max(0, c.contrib);
    });
  }

  while (contributors.some((c) => c.contrib > 0)) {
    const positive = contributors.filter((c) => c.contrib > 0);
    const minContrib = Math.min(...positive.map((c) => c.contrib));
    const sidePotAmount = minContrib * positive.length;
    const eligible = contributors.filter((c) => c.contrib >= minContrib && !c.player.folded).map((c) => c.player);

    if (eligible.length === 0) {
      const lastStanding = state.players.find((p) => !p.folded) || state.players[0];
      lastStanding.stack += sidePotAmount;
      appendLog(`${lastStanding.name} wins ${formatMoney(sidePotAmount)} (uncontested side pot).`);
    } else {
      const ranks = eligible.map((p) => ({ player: p, rank: evaluatePlayer(p, state.communityCards) }));
      ranks.sort((a, b) => compareHands(b.rank, a.rank));
      const bestRank = ranks[0].rank;
      const winners = ranks.filter((r) => compareHands(r.rank, bestRank) === 0).map((r) => r.player);
      const split = Math.floor(sidePotAmount / winners.length);
      const remainder = sidePotAmount % winners.length;

      winners.forEach((winner, index) => {
        const payout = split + (index === 0 ? remainder : 0);
        winner.stack += payout;
        appendLog(`${winner.name} wins ${formatMoney(payout)} from side pot (${getHandLabel(bestRank)}).`);
      });
    }

    contributors.forEach((c) => {
      if (c.contrib > 0) {
        c.contrib -= minContrib;
      }
    });
  }

  state.pot = 0;
}

function finishHand() {
  const stillIn = state.players.filter((player) => !player.folded);

  if (stillIn.length <= 1) {
    const winner = stillIn[0] || state.players.reduce((best, current) => (current.stack > best.stack ? current : best), state.players[0]);
    winner.stack += state.pot;
    state.pot = 0;
    appendLog(`${winner.name} wins the pot without showdown.`);
    setStatus(`${winner.name} wins the pot without showdown.`);
    state.currentStage = 'showdown';
    renderCommunityCards();
    renderPlayerSeats();
    updatePotDisplay();
    return;
  }

  distributePots();

  const showdown = state.players
    .filter((player) => !player.folded)
    .map((player) => ({ player, rank: evaluatePlayer(player, state.communityCards) }));

  if (showdown.length > 0) {
    showdown.sort((a, b) => compareHands(b.rank, a.rank));
    const winningRank = showdown[0].rank;
    const winners = showdown.filter((entry) => compareHands(entry.rank, winningRank) === 0);
    setStatus(`${winners.map((entry) => entry.player.name).join(', ')} win with ${getHandLabel(winningRank)}.`);
  }

  updatePotDisplay();
  state.currentStage = 'showdown';
  renderCommunityCards();
  renderPlayerSeats();
  updateBankrollDisplay();
}

function updateBankrollDisplay() {
  if (state.players[0]) {
    dom.bankroll.textContent = formatMoney(state.players[0].stack);
    dom.playerStack.textContent = formatMoney(state.players[0].stack);
  }
}

function beginHand() {
  if (state.aiTimer) clearTimeout(state.aiTimer);

  state.handNumber += 1;
  state.currentStage = 'preflop';
  state.deck = createDeck();
  state.communityCards = [];
  state.pot = 0;
  state.actionHistory = [];
  state.currentBet = 0;

  state.players.forEach((player) => {
    player.hand = [];
    player.folded = false;
    player.allIn = false;
    player.roundContribution = 0;
    player.totalContribution = 0;
    player.hasActedThisRound = false;
  });

  state.players.forEach((player) => {
    player.hand.push(state.deck.pop(), state.deck.pop());
  });

  const dealerIndex = state.dealerIndex % state.players.length;
  const smallBlindIndex = getNextIndex(dealerIndex, state.players.length);
  const bigBlindIndex = getNextIndex(smallBlindIndex, state.players.length);

  state.dealerIndex = getNextIndex(dealerIndex, state.players.length);
  state.currentPlayerIndex = bigBlindIndex;

  postBlind(state.players[smallBlindIndex], 10);
  postBlind(state.players[bigBlindIndex], 20);
  state.currentBet = 20;

  appendLog(`Hand #${state.handNumber} begins.`);
  appendLog(`${state.players[smallBlindIndex].name} posts the small blind.`);
  appendLog(`${state.players[bigBlindIndex].name} posts the big blind.`);
  setStatus(`Hand #${state.handNumber}: Action begins after the blinds.`);

  renderCommunityCards();
  renderPlayerSeats();
  updatePotDisplay();
  updateBankrollDisplay();
  state.currentPlayerIndex = getFirstActivePlayerAfter(bigBlindIndex);
  prepareTurn();
}

function decideAiAction(player) {
  const toCall = Math.max(0, state.currentBet - player.roundContribution);
  const combined = [...player.hand, ...state.communityCards];
  const bestRank = combined.length >= 5 ? bestFiveCards(combined) : { category: -1, value: [0] };
  const strength = bestRank.category;
  const difficulty = dom.difficulty.value;

  const aggressionByDifficulty = { beginner: 0.18, easy: 0.27, medium: 0.38, expert: 0.52 };
  const aggression = aggressionByDifficulty[difficulty] || 0.38;

  if (toCall === 0) {
    if (strength >= 5 || Math.random() < aggression) return 'raise';
    if (strength >= 2 && Math.random() < 0.55) return 'check';
    return 'check';
  }

  if (strength >= 7) return 'call';
  if (strength >= 5 && Math.random() < 0.8) return 'call';
  if (strength >= 2 && Math.random() < 0.45) return 'call';
  if (Math.random() < 0.18 + aggression * 0.2) return 'fold';
  return 'call';
}

function scheduleAiAction() {
  if (state.aiTimer) clearTimeout(state.aiTimer);

  const current = state.players[state.currentPlayerIndex];
  if (!current || current.isHuman || current.folded || current.allIn || state.currentStage === 'idle') {
    return;
  }

  state.aiTimer = setTimeout(() => {
    if (state.currentStage === 'idle') return;
    const player = state.players[state.currentPlayerIndex];
    if (!player || player.isHuman || player.folded || player.allIn) return;

    const action = decideAiAction(player);
    if (action === 'raise') {
      applyAction(player, 'raise', Math.max(state.currentBet + state.minimumRaise, 40));
    } else {
      applyAction(player, action);
    }
  }, 700 + Math.random() * 550);
}

function bindEvents() {
  dom.dealButton.addEventListener('click', beginHand);
  dom.checkButton.addEventListener('click', () => handleHumanAction('check'));
  dom.raiseButton.addEventListener('click', () => handleHumanAction('raise', Number(dom.betRange.value)));
  dom.foldButton.addEventListener('click', () => handleHumanAction('fold'));

  dom.resetButton.addEventListener('click', () => {
    const newBankroll = Number(dom.startingChips.value || 10000);
    if (state.players[0]) state.players[0].stack = newBankroll;
    resetTable();
    setStatus(`Practice chips reset to ${formatMoney(newBankroll)}. Choose Deal New Hand when ready.`);
  });

  dom.startingChips.addEventListener('change', () => {
    if (state.currentStage === 'idle') {
      const amount = Number(dom.startingChips.value || 10000);
      if (state.players[0]) state.players[0].stack = amount;
      updateBankrollDisplay();
      renderPlayerSeats();
    }
  });

  dom.numPlayers.addEventListener('change', () => {
    resetTable();
    setStatus('Seat count updated. Start a new hand when ready.');
  });

  dom.difficulty.addEventListener('change', () => {
    const level = dom.difficulty.options[dom.difficulty.selectedIndex].text;
    setStatus(`AI difficulty set to ${level}. Deal a new hand to test the table.`);
  });

  dom.betRange.addEventListener('input', () => {
    updateBetAmountLabel();
    dom.raiseButton.textContent = `Bet / Raise $${formatMoney(Number(dom.betRange.value || 20))}`;
  });
}

window.addEventListener('load', () => {
  createPlayers();
  bindEvents();
  resetTable();
  updateBetAmountLabel();
  updateBankrollDisplay();
  renderPlayerSeats();
});

window.pokerServerHooks = {
  getGameSnapshot() {
    return {
      stage: state.currentStage,
      pot: state.pot,
      currentBet: state.currentBet,
      communityCards: state.communityCards.map(cardToString),
      players: state.players.map((player) => ({
        name: player.name,
        stack: player.stack,
        folded: player.folded,
        allIn: player.allIn,
        totalContribution: player.totalContribution
      }))
    };
  },
  executeAction(action, amount) {
    if (state.currentStage === 'idle') return false;
    if (state.currentPlayerIndex !== 0) return false;
    handleHumanAction(action, amount);
    return true;
  },
  startNewHand() {
    beginHand();
    return true;
  },
  getVersion() {
    return '1.0.2';
  }
};

updateBetAmountLabel();
