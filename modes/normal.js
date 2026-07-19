/**
 * Normal mode: Stockfish just plays its best move, as usual.
 */
const NormalMode = {
  id: "normal",
  label: "Normal",
  description: "Stockfish always plays its strongest move.",

  /**
   * @param {StockfishEngine} engine
   * @param {Object} ctx - { fen, movetimeMs, legalMoveCount }
   * @returns {Promise<string>} UCI move string, e.g. "e2e4"
   */
  async getMove(engine, ctx) {
    const { bestmove } = await engine.go({
      fen: ctx.fen,
      movetime: ctx.movetimeMs,
      multipv: 1
    });
    return bestmove;
  }
};