/**
 * Thin wrapper around the Stockfish Web Worker.
 *
 * engine.go({ fen, movetime, multipv }) sends the position + search command,
 * collects all "info ... multipv N ... score ... pv ..." lines emitted during
 * the search, and resolves with:
 *   {
 *     bestmove: "e2e4",                  // Stockfish's actual best move (UCI)
 *     ranked: [ { move, score }, ... ]   // all seen moves, sorted best -> worst
 *   }
 *
 * `score` is always from the perspective of the side to move (higher = better).
 * Mate scores are mapped to large +/- numbers so sorting still works correctly.
 */
class StockfishEngine {
  constructor(workerPath) {
    this.worker = new Worker(workerPath);
    this._pending = null; // { moves: {idx: {move, score}}, resolve }

    this.readyPromise = new Promise((resolve) => {
      this.worker.onmessage = (e) => {
        const line = typeof e.data === "string" ? e.data : e.data.data;

        if (line === "uciok") {
          this.worker.postMessage("isready");
        } else if (line === "readyok") {
          resolve();
        } else {
          this._handleLine(line);
        }
      };
    });

    this.worker.postMessage("uci");
  }

  async ready() {
    return this.readyPromise;
  }

  /**
   * Run a search on a position.
   * @param {Object} opts
   * @param {string} opts.fen - FEN of the position to search.
   * @param {number} opts.movetime - milliseconds to think.
   * @param {number} opts.multipv - how many candidate lines to rank (1 = just best move).
   * @returns {Promise<{bestmove: string, ranked: Array<{move:string, score:number}>}>}
   */
  go({ fen, movetime = 1000, multipv = 1 }) {
    return this.readyPromise.then(() => {
      return new Promise((resolve) => {
        this._pending = { moves: {}, resolve };
        this.worker.postMessage("setoption name MultiPV value " + multipv);
        this.worker.postMessage("position fen " + fen);
        this.worker.postMessage("go movetime " + movetime);
      });
    });
  }

  _handleLine(line) {
    if (!this._pending) return;

    if (line.startsWith("info")) {
      this._parseInfo(line);
    } else if (line.startsWith("bestmove")) {
      const bestmove = line.split(" ")[1];
      const ranked = Object.values(this._pending.moves).sort((a, b) => b.score - a.score);
      const resolve = this._pending.resolve;
      this._pending = null;
      resolve({ bestmove, ranked });
    }
  }

  _parseInfo(line) {
    const multipvMatch = line.match(/multipv (\d+)/);
    const pvMatch = line.match(/ pv (\S+)/);
    if (!multipvMatch || !pvMatch) return;

    const mateMatch = line.match(/score mate (-?\d+)/);
    const cpMatch = line.match(/score cp (-?\d+)/);

    let score;
    if (mateMatch) {
      const m = parseInt(mateMatch[1], 10);
      // Mate scores always rank above/below any centipawn score.
      score = m > 0 ? 100000 - m : -100000 - m;
    } else if (cpMatch) {
      score = parseInt(cpMatch[1], 10);
    } else {
      return;
    }

    const idx = parseInt(multipvMatch[1], 10);
    this._pending.moves[idx] = { move: pvMatch[1], score };
  }
}