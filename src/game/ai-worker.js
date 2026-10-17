import { chooseMove } from './ai.js';

self.onmessage = (e) => {
  const { state, level, token } = e.data;
  const move = chooseMove(state, level);
  self.postMessage({ move, token });
};
