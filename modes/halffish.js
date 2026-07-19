/**
 * Halffish mode: flip a coin each move.
 *   Heads -> Stockfish plays its actual best move.
 *   Tails -> Stockfish plays its worst legal move (as ranked by its own eval).
 *
 * To find the "worst" move we ask Stockfish to rank every legal move via
 * MultiPV (one search line per legal move), then pick from the bottom of
 * that ranked list instead of the top.
 */
const HalffishMode = {
  id: "halffish",
  label: "Halffish",
  description: "50% chance Stockfish plays its best move, 50% chance it plays its worst.",

  /**
   * @param {StockfishEngine} engine
   * @param {Object} ctx - { fen, movetimeMs, legalMoveCount }
   * @returns {Promise<string>} UCI move string, e.g. "e2e4"
   */
  async getMove(engine, ctx) {
    const multipv = Math.max(1, ctx.legalMoveCount);
    const { bestmove, ranked } = await engine.go({
      fen: ctx.fen,
      movetime: ctx.movetimeMs,
      multipv
    });

    if (ranked.length === 0) {
      return bestmove; // fallback, shouldn't normally happen
    }

    const playBest = Math.random() < 0.5;
    const chosen = playBest ? ranked[0] : ranked[ranked.length - 1];
    return chosen.move;
  }
};