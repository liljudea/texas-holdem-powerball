const suits = [
  { symbol: '♠', red: false },
  { symbol: '♥', red: true },
  { symbol: '♦', red: true },
  { symbol: '♣', red: false }
];
const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const stageNames = {
  preflop: 'Preflop',
  flop: 'Flop',
  turn: 'Turn',
  river: 'River',
  showdown: 'Showdown'
};

const dom = {
  balance: document.getElementById('balance'),
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
  turnIndicator: document.getElementById('turn-indicator'),
  playerCards: document.getElementById('player-cards'),
  communityCards: document.getElementById('community-cards'),
  playerName: document.getElementById('human-name'),
  ai1Name: document.getElementById('ai-1-name'),
  ai2Name: document.getElementById('ai-2-name'),
  ai3Name: document.getElementById('ai-3-name'),
  ai1Stack: document.getElementById('ai-1-stack'),
  ai2Stack: document.getElementById('ai-2-stack'),
  ai3Stack: document.getElementById('ai-3-stack'),
  ai1Cards: document.getElementById('ai-1-cards'),
  ai2Cards: document.getElementById('ai-2-cards'),
  ai3Cards: document.getElementById('ai-3-cards')
};

const state = {
  players: [],
  deck: [],
  communityCards: [],
  pot: 0,
  currentStage: 'idle',
  dealerIndex: 0,
  currentPlayerIndex: 0,
  currentBet: 0,
  smallBlind: 10,
  bigBlind: 20,
  minimumRaise: 20,
  handNumber: 1,
  gameActive: false,
  winnerText: '',
  aiTimer: null,
  lastServerSnapshot: {}
};

function formatMoney(value) {
  return value.toLocaleString('en-US');
}

function getNextIndex(index, count = state.players.length) {
  return (index + 1) % count;
}

function getPreviousIndex(index, count = state.players.length) {
  return (index - 1 + count) % count;
}

function createDeck() {
  const deck = [];
  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({ rank, suit });
    }
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function cardToString(card) {
  return `${card.rank}${card.suit.symbol}`;
}

function renderCard(card, reveal = true) {
  const el = document.createElement('span');
  el.className = 'card' + (card && card.suit && card.suit.red ? ' red' : '');
  el.textContent = reveal && card ? cardToString(card) : '★';
  if (!reveal) {
    el.classList.add('back');
  }
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

function renderSeatCards(player) {
  if (!player) return;
  const cardsEl = player.isHuman ? dom.playerCards : document.getElementById(`${player.seatId}-cards`);
  cardsEl.innerHTML = '';

  if (state.currentStage === 'idle' && !player.isHuman) {
    cardsEl.appendChild(renderCard({ rank: 'X', suit: { symbol: '★', red: false } }, false));
    cardsEl.appendChild(renderCard({ rank: 'X', suit: { symbol: '★', red: false } }, false));
    return;
  }

  const reveal = state.currentStage === 'showdown' || player.isHuman || player.showCards;
  if (!player.hand.length) {
    cardsEl.appendChild(renderPlaceholder());
    cardsEl.appendChild(renderPlaceholder());
    return;
  }

  player.hand.forEach((card) => {
    cardsEl.appendChild(renderCard(card, reveal));
  });

  if (player.hand.length === 1) {
    cardsEl.appendChild(renderPlaceholder());
  }
}

function renderPlayerSeats() {
  const seatNames = {
    human: 'YOU',
    ai1: 'AI Player 1',
    ai2: 'AI Player 2',
    ai3: 'AI Player 3'
  };

  const stackEls = {
    human: dom.playerStack,
    ai1: dom.ai1Stack,
    ai2: dom.ai2Stack,
    ai3: dom.ai3Stack
  };

  const nameEls = {
    human: dom.playerName,
    ai1: dom.ai1Name,
    ai2: dom.ai2Name,
    ai3: dom.ai3Name
  };

  state.players.forEach((player) => {
    const label = seatNames[player.id];
    if (nameEls[player.id]) {
      nameEls[player.id].innerHTML = `${label}${player.isHuman ? ' <span class="you-tag">PLAYER</span>' : ''}`;
    }
    if (stackEls[player.id]) {
      stackEls[player.id].textContent = formatMoney(player.stack);
    }
    renderSeatCards(player);
  });

  dom.bankroll.textContent = formatMoney(state.players[0].stack);
}

function createPlayers() {
  state.players = [
    {
      id: 'human',
      name: 'YOU',
      isHuman: true,
      seatId: 'human',
      stack: Number(dom.startingChips.value),
      hand: [],
      folded: false,
      allIn: false,
      isDealer: false,
      isSmallBlind: false,
      isBigBlind: false,
      isActive: true,
      roundContribution: 0,
      hasActedThisRound: false,
      showCards: true,
      lastAction: 'Waiting',
      status: 'Ready'
    },
    {
      id: 'ai1',
      name: 'AI Player 1',
      isHuman: false,
      seatId: 'ai-1',
      stack: Number(dom.startingChips.value) * 0.2,
      hand: [],
      folded: false,
      allIn: false,
      isDealer: false,
      isSmallBlind: false,
      isBigBlind: false,
      isActive: true,
      roundContribution: 0,
      hasActedThisRound: false,
      showCards: false,
      lastAction: 'Waiting',
      status: 'Ready'
    },
    {
      id: 'ai2',
      name: 'AI Player 2',
      isHuman: false,
      seatId: 'ai-2',
      stack: Number(dom.startingChips.value) * 0.2,
      hand: [],
      folded: false,
      allIn: false,
      isDealer: false,
      isSmallBlind: false,
      isBigBlind: false,
      isActive: true,
      roundContribution: 0,
      hasActedThisRound: false,
      showCards: false,
      lastAction: 'Waiting',
      status: 'Ready'
    },
    {
      id: 'ai3',
      name: 'AI Player 3',
      isHuman: false,
      seatId: 'ai-3',
      stack: Number(dom.startingChips.value) * 0.2,
      hand: [],
      folded: false,
      allIn: false,
      isDealer: false,
      isSmallBlind: false,
      isBigBlind: false,
      isActive: true,
      roundContribution: 0,
      hasActedThisRound: false,
      showCards: false,
      lastAction: 'Waiting',
      status: 'Ready'
    }
  ];
}

function setStatus(message) {
  dom.status.textContent = message;
}

function updateBetControls() {
  const humanPlayer = state.players[0];
  const toCall = Math.max(0, state.currentBet - humanPlayer.roundContribution);
  const rangeMin = Math.max(20, state.currentBet + 20);
  dom.betRange.min = String(Math.max(20, state.currentBet + 20));
  dom.betRange.max = String(Math.max(rangeMin, humanPlayer.stack));
  dom.betRange.value = String(Math.max(rangeMin, state.currentBet + 20));
  dom.betAmountLabel.textContent = `$${Number(dom.betRange.value).toLocaleString()}`;

  dom.checkButton.textContent = toCall > 0 ? `Call $${formatMoney(toCall)}` : 'Check';
  dom.raiseButton.textContent = toCall > 0 ? `Raise to $${formatMoney(Number(dom.betRange.value))}` : `Bet $${formatMoney(Number(dom.betRange.value))}`;
}

function setTurnIndicator(message) {
  dom.turnIndicator.textContent = message;
}

function resetRoundContribution() {
  state.players.forEach((player) => {
    player.roundContribution = 0;
    player.hasActedThisRound = false;
  });
}

function getLivingPlayers() {
  return state.players.filter((player) => !player.folded && !player.allIn);
}

function dealBlinds() {
  const smallBlindIndex = getNextIndex(state.dealerIndex);
  const bigBlindIndex = getNextIndex(smallBlindIndex);

  state.players[smallBlindIndex].isSmallBlind = true;
  state.players[bigBlindIndex].isBigBlind = true;

  state.players[smallBlindIndex].stack -= state.smallBlind;
  state.players[smallBlindIndex].roundContribution = state.smallBlind;
  state.pot += state.smallBlind;

  state.players[bigBlindIndex].stack -= state.bigBlind;
  state.players[bigBlindIndex].roundContribution = state.bigBlind;
  state.pot += state.bigBlind;
  state.currentBet = state.bigBlind;

  state.currentPlayerIndex = getNextIndex(bigBlindIndex);
  setTurnIndicator(`${state.players[state.currentPlayerIndex].name}'s turn`);
}

function beginHand() {
  if (state.aiTimer) {
    clearTimeout(state.aiTimer);
  }

  state.deck = createDeck();
  state.communityCards = [];
  state.pot = 0;
  state.currentStage = 'preflop';
  state.currentBet = 0;
  state.gameActive = true;
  state.winnerText = '';

  state.players.forEach((player) => {
    player.hand = [];
    player.folded = false;
    player.allIn = false;
    player.lastAction = 'Waiting';
    player.status = 'Ready';
    player.isDealer = false;
    player.isSmallBlind = false;
    player.isBigBlind = false;
    player.roundContribution = 0;
    player.hasActedThisRound = false;
    player.showCards = false;
  });

  state.dealerIndex = (state.dealerIndex + 1) % state.players.length;
  state.players[state.dealerIndex].isDealer = true;

  for (let i = 0; i < 2; i += 1) {
    state.players.forEach((player) => {
      player.hand.push(state.deck.pop());
    });
  }

  dealBlinds();
  renderCommunityCards();
  renderPlayerSeats();
  updateBetControls();
  state.players.forEach((player) => {
    if (player.isHuman) {
      player.showCards = true;
    }
  });

  if (state.players[state.currentPlayerIndex].isHuman) {
    setStatus('Your turn. Call, raise, or fold.');
    enableHumanControls();
  } else {
    setStatus('AI players are acting.');
    disableHumanControls();
    scheduleAiAction();
  }

  updateServerSnapshot();
}

function updatePot() {
  dom.pot.textContent = formatMoney(state.pot);
}

function updateBankroll() {
  dom.bankroll.textContent = formatMoney(state.players[0].stack);
  dom.playerStack.textContent = formatMoney(state.players[0].stack);
}

function setPlayerBet(player, totalContribution) {
  const delta = Math.max(0, totalContribution - player.roundContribution);
  if (delta <= 0) {
    return;
  }

  const actual = Math.min(delta, player.stack);
  player.stack -= actual;
  state.pot += actual;
  player.roundContribution += actual;
  state.currentBet = Math.max(state.currentBet, player.roundContribution);

  if (player.stack === 0) {
    player.allIn = true;
    player.status = 'All-in';
  }
}

function isRoundComplete() {
  const active = getLivingPlayers();
  if (active.length <= 1) {
    return true;
  }

  const maxContribution = Math.max(...active.map((player) => player.roundContribution));
  return active.every((player) => player.hasActedThisRound && player.roundContribution === maxContribution);
}

function advanceTurn() {
  const active = getLivingPlayers();
  if (active.length === 1) {
    finishHand();
    return;
  }

  let attempts = 0;
  while (attempts < state.players.length) {
    state.currentPlayerIndex = getNextIndex(state.currentPlayerIndex);
    const player = state.players[state.currentPlayerIndex];
    attempts += 1;

    if (!player.folded && !player.allIn && !player.hasActedThisRound) {
      if (player.isHuman) {
        setStatus('Your turn. Call, raise, or fold.');
        enableHumanControls();
      } else {
        setStatus(`${player.name} is thinking...`);
        disableHumanControls();
        scheduleAiAction();
      }
      setTurnIndicator(`${player.name}'s turn`);
      return;
    }
  }

  if (isRoundComplete()) {
    resolveStreet();
  }
}

function finishHand() {
  const active = state.players.filter((player) => !player.folded);
  if (active.length <= 1) {
    const winner = active[0] || state.players.reduce((best, player) => (best.stack > player.stack ? best : player));
    winner.stack += state.pot;
    setStatus(`${winner.name} wins the pot of ${formatMoney(state.pot)}.`);
    state.winnerText = `${winner.name} wins the pot of ${formatMoney(state.pot)}.`;
  } else {
    const showdown = state.players
      .filter((player) => !player.folded)
      .map((player) => ({ player, rank: evaluatePlayer(player, state.communityCards) }))
      .sort((a, b) => compareHands(a.rank, b.rank));

    const winners = showdown.filter((entry) => compareHands(entry.rank, showdown[0].rank) === 0);
    const prize = Math.floor(state.pot / winners.length);
    const remainder = state.pot % winners.length;

    winners.forEach((entry, index) => {
      entry.player.stack += prize + (index === 0 ? remainder : 0);
    });

    const winnerNames = winners.map((entry) => entry.player.name).join(', ');
    setStatus(`${winnerNames} win the pot of ${formatMoney(state.pot)}.`);
    state.winnerText = `${winnerNames} win the pot of ${formatMoney(state.pot)}.`;
  }

  state.players.forEach((player) => {
    player.showCards = true;
  });

  renderCommunityCards();
  renderPlayerSeats();
  updateBankroll();
  updatePot();
  state.currentStage = 'showdown';
  renderCommunityCards();
  updateServerSnapshot();
  disableHumanControls();
}

function resolveStreet() {
  if (state.currentStage === 'preflop') {
    state.currentStage = 'flop';
    state.communityCards.push(state.deck.pop(), state.deck.pop(), state.deck.pop());
    state.players.forEach((player) => {
      player.roundContribution = 0;
      player.hasActedThisRound = false;
    });
    state.currentBet = 0;
    state.currentPlayerIndex = state.dealerIndex;
    setStatus(`Flop dealt: ${state.communityCards.map(cardToString).join(' ')}`);
  } else if (state.currentStage === 'flop') {
    state.currentStage = 'turn';
    state.communityCards.push(state.deck.pop());
    state.players.forEach((player) => {
      player.roundContribution = 0;
      player.hasActedThisRound = false;
    });
    state.currentBet = 0;
    state.currentPlayerIndex = state.dealerIndex;
    setStatus(`Turn dealt: ${state.communityCards.map(cardToString).join(' ')}`);
  } else if (state.currentStage === 'turn') {
    state.currentStage = 'river';
    state.communityCards.push(state.deck.pop());
    state.players.forEach((player) => {
      player.roundContribution = 0;
      player.hasActedThisRound = false;
    });
    state.currentBet = 0;
    state.currentPlayerIndex = state.dealerIndex;
    setStatus(`River dealt: ${state.communityCards.map(cardToString).join(' ')}`);
  } else if (state.currentStage === 'river') {
    finishHand();
    return;
  }

  renderCommunityCards();
  updateServerSnapshot();
  advanceTurn();
}

function enableHumanControls() {
  const human = state.players[0];
  const toCall = Math.max(0, state.currentBet - human.roundContribution);
  dom.checkButton.disabled = false;
  dom.raiseButton.disabled = false;
  dom.foldButton.disabled = false;
  dom.checkButton.textContent = toCall > 0 ? `Call $${formatMoney(toCall)}` : 'Check';
  dom.raiseButton.textContent = toCall > 0 ? `Raise to $${formatMoney(Number(dom.betRange.value))}` : `Bet $${formatMoney(Number(dom.betRange.value))}`;
}

function disableHumanControls() {
  dom.checkButton.disabled = true;
  dom.raiseButton.disabled = true;
  dom.foldButton.disabled = true;
}

function scheduleAiAction() {
  if (state.aiTimer) clearTimeout(state.aiTimer);
  const player = state.players[state.currentPlayerIndex];
  state.aiTimer = setTimeout(() => {
    if (state.currentStage === 'idle') return;
    const action = decideAiAction(player);
    performAction(player, action.action, action.amount);
  }, 700 + Math.random() * 700);
}

function handleHumanAction(action) {
  if (state.currentStage === 'idle') return;
  const human = state.players[0];
  if (state.currentPlayerIndex !== 0 || human.folded || human.allIn) return;

  if (action === 'fold') {
    performAction(human, 'fold');
    return;
  }

  if (action === 'check') {
    const toCall = Math.max(0, state.currentBet - human.roundContribution);
    if (toCall > 0) {
      performAction(human, 'call');
    } else {
      performAction(human, 'check');
    }
    return;
  }

  const betValue = Number(dom.betRange.value);
  performAction(human, 'raise', betValue);
}

function performAction(player, action, amount = 0) {
  if (!player || player.folded || player.allIn) return;

  if (player.isHuman && state.currentPlayerIndex !== 0) return;
  if (!player.isHuman && state.currentPlayerIndex !== state.players.indexOf(player)) return;

  const toCall = Math.max(0, state.currentBet - player.roundContribution);

  if (action === 'fold') {
    player.folded = true;
    player.hasActedThisRound = true;
    player.lastAction = 'Fold';
    player.status = 'Folded';
    setStatus(`${player.name} folds.`);
    if (player.isHuman) disableHumanControls();
    advanceTurn();
    updateServerSnapshot();
    return;
  }

  if (action === 'check') {
    if (toCall > 0) {
      action = 'call';
    } else {
      player.hasActedThisRound = true;
      player.lastAction = 'Check';
      player.status = 'Checked';
      setStatus(`${player.name} checks.`);
      if (player.isHuman) disableHumanControls();
      advanceTurn();
      updateServerSnapshot();
      return;
    }
  }

  if (action === 'call') {
    const callAmount = Math.min(player.stack, toCall);
    if (callAmount <= 0) {
      player.allIn = true;
      player.status = 'All-in';
      player.lastAction = 'All-in';
      setStatus(`${player.name} is all-in.`);
      player.hasActedThisRound = true;
      if (player.isHuman) disableHumanControls();
      advanceTurn();
      return;
    }

    player.stack -= callAmount;
    state.pot += callAmount;
    player.roundContribution += callAmount;
    player.hasActedThisRound = true;
    player.lastAction = 'Call';
    player.status = 'Called';
    if (player.stack === 0) {
      player.allIn = true;
      player.status = 'All-in';
    }
    setStatus(`${player.name} calls ${formatMoney(callAmount)}.`);
    if (player.isHuman) disableHumanControls();
    updatePot();
    updateBankroll();
    updateServerSnapshot();
    if (isRoundComplete()) {
      resolveStreet();
    } else {
      advanceTurn();
    }
    return;
  }

  if (action === 'raise' || action === 'bet') {
    const totalBet = Math.max(Number(amount) || 0, state.currentBet + state.minimumRaise);
    const totalContribution = Math.max(player.roundContribution + 1, totalBet);
    const delta = totalContribution - player.roundContribution;

    if (delta <= 0) {
      return;
    }

    const actualContribution = Math.min(delta, player.stack);
    player.stack -= actualContribution;
    state.pot += actualContribution;
    player.roundContribution += actualContribution;
    state.currentBet = Math.max(state.currentBet, player.roundContribution);
    player.hasActedThisRound = true;
    player.lastAction = action === 'raise' ? 'Raise' : 'Bet';
    player.status = action === 'raise' ? 'Raised' : 'Bet';

    if (player.stack === 0) {
      player.allIn = true;
      player.status = 'All-in';
    }

    setStatus(`${player.name} ${action === 'raise' ? 'raises' : 'bets'} to ${formatMoney(player.roundContribution)}.`);
    if (player.isHuman) disableHumanControls();
    updatePot();
    updateBankroll();
    updateServerSnapshot();
    if (isRoundComplete()) {
      resolveStreet();
    } else {
      advanceTurn();
    }
  }
}

function decideAiAction(player) {
  const toCall = Math.max(0, state.currentBet - player.roundContribution);
  const board = state.communityCards;
  const strength = evaluateBestHand(player.hand.concat(board));
  const rankValue = strength.category;

  let action = 'check';
  let amount = 0;

  if (toCall > 0) {
    if (rankValue >= 7 || (state.currentStage === 'preflop' && rankValue >= 5)) {
      action = 'raise';
      amount = Math.max(state.currentBet + 40, player.roundContribution + 40);
    } else if (rankValue >= 3) {
      action = 'call';
    } else {
      action = Math.random() < 0.35 ? 'call' : 'fold';
    }
  } else {
    if ((state.currentStage === 'preflop' && rankValue >= 6) || rankValue >= 8) {
      action = 'raise';
      amount = state.currentBet + (state.bigBlind * 2);
    } else if (rankValue >= 4 && Math.random() < 0.7) {
      action = 'bet';
      amount = state.currentBet + 30;
    } else {
      action = 'check';
    }
  }

  return { action, amount };
}

function evaluateBestHand(cards) {
  if (cards.length < 5) {
    return { category: 0, value: [0] };
  }

  const combinations = [];
  for (let i = 0; i < cards.length - 4; i += 1) {
    for (let j = i + 1; j < cards.length - 3; j += 1) {
      for (let k = j + 1; k < cards.length - 2; k += 1) {
        for (let l = k + 1; l < cards.length - 1; l += 1) {
          for (let m = l + 1; m < cards.length; m += 1) {
            combinations.push([cards[i], cards[j], cards[k], cards[l], cards[m]]);
          }
        }
      }
    }
  }

  return combinations
    .map((combo) => evaluateHand(combo))
    .sort((a, b) => compareHands(a, b))
    .slice(-1)[0] || { category: 0, value: [0] };
}

function evaluateHand(cards) {
  const values = cards.map((card) => convertRank(card.rank));
  const counts = [];
  const suits = cards.map((card) => card.suit.symbol);

  values.sort((a, b) => a - b);

  const countsMap = {};
  values.forEach((value) => {
    countsMap[value] = (countsMap[value] || 0) + 1;
  });

  const frequency = Object.values(countsMap).sort((a, b) => b - a);
  const sortedRanks = Object.keys(countsMap).map(Number).sort((a, b) => b - a);

  const isFlush = [...new Set(suits)].length === 1;
  const isStraight = isSequential(values);

  if (isStraight && isFlush && values[4] === 14) return { category: 9, value: [14] };
  if (isStraight && isFlush) return { category: 8, value: [values[4]] };
  if (frequency[0] === 4) return { category: 7, value: [sortedRanks[0], sortedRanks[1]] };
  if (frequency[0] === 3 && frequency[1] === 2) return { category: 6, value: [sortedRanks[0], sortedRanks[1]] };
  if (isFlush) return { category: 5, value: [...values].reverse() };
  if (isStraight) return { category: 4, value: [values[4]] };
  if (frequency[0] === 3) return { category: 3, value: [sortedRanks[0], ...sortedRanks.slice(1).reverse()] };
  if (frequency[0] === 2 && frequency[1] === 2) return { category: 2, value: [sortedRanks[0], sortedRanks[1], ...sortedRanks.slice(2).reverse()] };
  if (frequency[0] === 2) return { category: 1, value: [sortedRanks[0], ...sortDesc(values.filter((v) => v !== sortedRanks[0]))] };
  return { category: 0, value: [...values].reverse() };
}

function compareHands(a, b) {
  if (a.category !== b.category) return a.category - b.category;
  for (let i = 0; i < Math.max(a.value.length, b.value.length); i += 1) {
    const av = a.value[i] || 0;
    const bv = b.value[i] || 0;
    if (av !== bv) return av - bv;
  }
  return 0;
}

function evaluatePlayer(player, boardCards) {
  return evaluateBestHand(player.hand.concat(boardCards));
}

function isSequential(values) {
  const arr = [...new Set(values)].sort((a, b) => a - b);
  if (arr.length !== 5) return false;
  if (arr[0] === 10 && arr[1] === 11 && arr[2] === 12 && arr[3] === 13 && arr[4] === 14) return true;
  for (let i = 1; i < arr.length; i += 1) {
    if (arr[i] !== arr[i - 1] + 1) {
      return false;
    }
  }
  return true;
}

function convertRank(rank) {
  const map = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, J: 11, Q: 12, K: 13, A: 14 };
  return map[rank];
}

function sortDesc(values) {
  return values.slice().sort((a, b) => b - a);
}

function updateServerSnapshot() {
  state.lastServerSnapshot = {
    stage: state.currentStage,
    pot: state.pot,
    currentBet: state.currentBet,
    communityCards: state.communityCards.map(cardToString),
    players: state.players.map((player) => ({
      id: player.id,
      name: player.name,
      stack: player.stack,
      folded: player.folded,
      allIn: player.allIn,
      status: player.status,
      hand: player.hand.map(cardToString)
    }))
  };

  window.pokerServerHooks = {
    getGameSnapshot: () => ({ ...state.lastServerSnapshot }),
    executeAction: (playerName, action, amount) => {
      const player = state.players.find((entry) => entry.name === playerName || entry.id === playerName);
      if (!player) return false;
      performAction(player, action, amount);
      return true;
    },
    startNewHand: () => beginHand(),
    getVersion: () => 'server-ready-v1'
  };
}

function resetTable() {
  state.currentStage = 'idle';
  state.pot = 0;
  state.currentBet = 0;
  state.communityCards = [];
  state.players = [];
  createPlayers();
  renderCommunityCards();
  renderPlayerSeats();
  updatePot();
  updateBankroll();
  setTurnIndicator('Waiting for deal');
  setStatus('Welcome! Start a hand and watch the AI table react.');
  disableHumanControls();
  updateServerSnapshot();
}

function handleRangeUpdate() {
  const value = Number(dom.betRange.value);
  dom.betAmountLabel.textContent = `$${value.toLocaleString()}`;
  if (state.players[0] && state.players[0].isHuman) {
    dom.raiseButton.textContent = state.currentBet > 0
      ? `Raise to $${value.toLocaleString()}`
      : `Bet $${value.toLocaleString()}`;
  }
}

function bindEvents() {
  dom.dealButton.addEventListener('click', beginHand);
  dom.checkButton.addEventListener('click', () => handleHumanAction('check'));
  dom.raiseButton.addEventListener('click', () => handleHumanAction('raise'));
  dom.foldButton.addEventListener('click', () => handleHumanAction('fold'));
  dom.resetButton.addEventListener('click', () => {
    const nextChips = Number(dom.startingChips.value);
    state.players[0].stack = nextChips;
    resetTable();
    setStatus(`Practice chips reset to ${formatMoney(nextChips)}. Choose Deal New Hand when ready.`);
  });
  dom.startingChips.addEventListener('change', () => {
    const nextChips = Number(dom.startingChips.value);
    if (state.players.length && state.currentStage !== 'idle') {
      state.players[0].stack = nextChips;
      renderPlayerSeats();
      updateBankroll();
    }
  });
  dom.betRange.addEventListener('input', handleRangeUpdate);
}

window.addEventListener('load', () => {
  createPlayers();
  bindEvents();
  resetTable();
  updateBetControls();
  updateServerSnapshot();
});

window.pokerServerHooks = {
  getGameSnapshot: () => ({ stage: state.currentStage, pot: state.pot, currentBet: state.currentBet, players: [] }),
  executeAction: () => false,
  startNewHand: () => beginHand(),
  getVersion: () => 'server-ready-v1'
};
