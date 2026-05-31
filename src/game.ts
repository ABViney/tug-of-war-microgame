
export const GameStatuses = {
  NotReady: 0,
  Ready: 1,
  InProgress: 2,
  Finished: 3,
}
export type GameStatus = typeof GameStatuses[keyof typeof GameStatuses];

const GameOutcomes = {
  Unset : 0,
  Loss : 1,
  Win : 2,
}
export type GameOutcome = typeof GameOutcomes[keyof typeof GameOutcomes];

type GameState = {
  is_loaded: boolean, // if assets are loaded
  difficulty: number; // 0-100
  status: GameStatus, // stage in the game loop
  outcome: GameOutcome, // result of the game
};

const Operations = {
  done: "done",
  ready: "ready",
  start: "start",
  started: "started",
};
type Operation = typeof Operations[keyof typeof Operations];


type MessageEventData = 
  | { op: typeof Operations.start;   difficulty: number; };

type MessageEventPayload = 
  | { op: typeof Operations.ready;                 }
  | { op: typeof Operations.started; verb: string; }
  | { op: typeof Operations.done;    win: boolean; }


export abstract class Game {

  getDifficulty(): number { return this._difficulty; }

  /**
   * Loads assets then runs the game on a continuous loop, listening for events
   * and updating/invoking callbacks as appropriate.
   */
  async run() {
    // Load assets and be ready to start;
    // Notify harness that game is loaded
    this._load();

    // game loop
    while (true) {
      // await start signal
      // configures difficulty internally
      await this._awaitStartSignal();

      // start game
      // determine result
      const win: boolean = await this._startGame();

      // report outcome
      const outcome: MessageEventPayload = {op: Operations.done, win: win};
      this._postMessage(outcome)
    }
  }

  constructor() {}

  abstract readonly _onLoadCallback: () => Promise<void>;
  abstract readonly verb: string;
  abstract readonly _onStartGameCallback: () => Promise<boolean>;

  /**
   * When the page is loaded, assets for the game should be loaded.
   */
  async _load(): Promise<void> {
    if (this._onLoadCallback === undefined) {
      throw new Error("No callback set for onLoad");
    }
    
    await this._onLoadCallback();

    window.parent.postMessage({op: "ready"}); 
  }

  /**
   * The difficulty is provided when the game is informed to start.
   * The child can call getDifficulty when starting the game.
   */
  _difficulty: number = 0;

  /**
   * When invoked, the game should run and return a boolean indicating if the
   * player won or lost.
   */
  async _startGame(): Promise<boolean> {
    if (this._onStartGameCallback === undefined) {
      throw new Error("No callback set for onGameStart");
    }

    return await this._onStartGameCallback();
  }

  /**
   * Waits for the start signal from the harness.
   * Once the signal is received, the difficulty is provided to the implementing game.
   */
  async _awaitStartSignal(): Promise<void> {
    let waiting_for_start_signal = true
    
    // Checks if the op 
    const startSignalListenerCallback = (event: MessageEvent<MessageEventData>) => {
      const data = event.data;
      if (data.op === Operations.start)
      {
        // Difficulty is only provided here. 
        this._difficulty = data.difficulty;
        window.removeEventListener("message", startSignalListenerCallback);
        waiting_for_start_signal = false;
      }
    }

    // Wait in an infinite loop until the event is received.
    window.addEventListener("message", startSignalListenerCallback);
    while (waiting_for_start_signal) { }
  }

  _postMessage(payload: MessageEventPayload) {
    window.parent.postMessage(payload);
  }
}