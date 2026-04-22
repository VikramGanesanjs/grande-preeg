import { create } from 'zustand';
import { websocketService } from '../services/websocket';

const RANKS = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const SUITS = ['♠','♥','♦','♣'];
const FLIP_INTERVAL = 2500;
const JACK_WINDOW_MS = 2300;

type Card = { rank: string; suit: string };
type GameStatus = 'idle' | 'playing' | 'finished';

function buildDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS)
    for (const rank of RANKS)
      deck.push({ rank, suit });
  // Extra jacks for ~15% rate
  for (const suit of SUITS) deck.push({ rank: 'J', suit });
  return deck;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

interface SlapjackState {
  deck: Card[];
  pile: Card[];
  currentCard: Card | null;
  recentCards: Card[];
  score: number;
  round: number;
  bestRT: number;
  jackWindow: boolean;
  isJack: boolean;
  isSequence: boolean;
  jackAppearTime: number | null;
  suitStreak: string[];
  status: GameStatus;
  eegPSlap: number | null;
  eegTrigger: boolean;
  lastFeedback: 'win' | 'lose' | null;
  flipTimer: ReturnType<typeof setTimeout> | null;
  jackTimer: ReturnType<typeof setTimeout> | null;
}

interface SlapjackActions {
  startGame: () => void;
  resetGame: () => void;
  triggerSlap: () => void;
  _flipCard: () => void;
}

const initialState: SlapjackState = {
  deck: [], pile: [], currentCard: null, recentCards: [],
  score: 0, round: 0, bestRT: Infinity,
  jackWindow: false, isJack: false, isSequence: false,
  jackAppearTime: null, suitStreak: [],
  status: 'idle', eegPSlap: null, eegTrigger: false,
  lastFeedback: null, flipTimer: null, jackTimer: null,
};

export const useSlapjackStore = create<SlapjackState & SlapjackActions>((set, get) => {
  // Wire up the EEG bridge from backend
  websocketService.onMessage((msg: any) => {
    if (msg.type === 'neurojack_prediction') {
      const state = get();
      set({ eegPSlap: msg.p_slap, eegTrigger: msg.trigger });
      // Auto-slap when EEG triggers and jack window is open
      if (msg.trigger && state.jackWindow && state.status === 'playing') {
        const now = performance.now?.() ?? Date.now();
        const last = state.jackAppearTime ?? 0;
        if (now - last > 800) { // cooldown
          get().triggerSlap();
        }
      }
    }
  });

  function scheduleFlip(delay = FLIP_INTERVAL) {
    const t = setTimeout(() => get()._flipCard(), delay);
    set({ flipTimer: t });
  }

  function clearTimers() {
    const s = get();
    if (s.flipTimer) clearTimeout(s.flipTimer);
    if (s.jackTimer) clearTimeout(s.jackTimer);
    set({ flipTimer: null, jackTimer: null });
  }

  return {
    ...initialState,

    startGame() {
      clearTimers();
      set({
        ...initialState,
        deck: shuffle(buildDeck()),
        status: 'playing',
      });
      scheduleFlip(500);
    },

    resetGame() {
      clearTimers();
      set({ ...initialState });
    },

    _flipCard() {
      const s = get();
      if (s.status !== 'playing') return;

      let { deck, pile } = s;
      if (deck.length === 0) {
        if (pile.length === 0) { set({ status: 'finished' }); return; }
        deck = shuffle(buildDeck());
        pile = [];
      }

      const card = deck[deck.length - 1];
      const newDeck = deck.slice(0, -1);
      const newPile = [...pile, card];
      const recentCards = s.currentCard
        ? [s.currentCard, ...s.recentCards].slice(0, 2)
        : s.recentCards;

      // Suit streak
      const suitKey = { '♠':'spade','♥':'heart','♦':'diamond','♣':'club' }[card.suit]!;
      const newStreak = [suitKey, ...s.suitStreak].slice(0, 3);
      const isSequence = newStreak.length === 3 &&
        newStreak[0] === newStreak[1] && newStreak[1] === newStreak[2];
      const isJack = card.rank === 'J';

      set({
        currentCard: card, deck: newDeck, pile: newPile,
        recentCards, suitStreak: newStreak,
        isJack, isSequence,
        round: s.round + 1,
      });

      if (isJack || isSequence) {
        const appearTime = Date.now();
        set({ jackWindow: true, jackAppearTime: appearTime });

        const jt = setTimeout(() => {
          const cur = get();
          if (cur.jackWindow) {
            set({ jackWindow: false, isJack: false, isSequence: false, lastFeedback: 'lose' });
          }
        }, JACK_WINDOW_MS);
        set({ jackTimer: jt });
      } else {
        set({ jackWindow: false });
      }

      scheduleFlip();
    },

    triggerSlap() {
      const s = get();
      if (s.status !== 'playing') return;

      if ((s.isJack || s.isSequence) && s.jackWindow) {
        const rt = s.jackAppearTime ? (Date.now() - s.jackAppearTime) / 1000 : null;
        const pts = rt ? Math.max(1, Math.floor(10 - rt / 0.2)) : 5;
        set({
          score: s.score + pts,
          bestRT: rt && rt < s.bestRT ? rt : s.bestRT,
          jackWindow: false, isJack: false, isSequence: false,
          pile: [], suitStreak: [],
          lastFeedback: 'win',
        });
        const { isMultiplayer, broadcastScore } = 
            require('./slapjackMultiplayerStore').useSlapjackMultiplayerStore.getState();
        if (isMultiplayer) {
            broadcastScore(s.score + pts);
        }
        if (s.jackTimer) clearTimeout(s.jackTimer);
      } else if (!s.isJack && !s.isSequence) {
        set({ score: Math.max(0, s.score - 3), lastFeedback: 'lose' });
      }
    },
  };
});