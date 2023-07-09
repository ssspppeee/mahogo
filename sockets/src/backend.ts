import { Cell, Move, Board } from "./Go";
import { Redis } from "ioredis";

function getPlayer(cell: Cell): Player { 
  if (cell === Cell.Black) {
    return Player.Black;
  }
  else if (cell === Cell.White) {
    return Player.White;
  }
  else {
    throw Error(`Attempted to get player from cell with value ${cell}`)
  }
}

enum Player {
  Black,
  White
}

enum GameStage {
  Play,
  MarkDead,
  Over
}

type Position = number;

export abstract class Message {
  abstract execute(backend: Backend, userConnection?: UserConnection): void;
}

export class JoinMessage extends Message {
  gameID: string;

  constructor(gameID: string) {
    super()
    this.gameID = gameID;
  }

  async execute(backend: Backend, userConnection: UserConnection): Promise<void> {
    backend.subscribeToGame(this.gameID, userConnection);
    let nConnections = await backend.getNumberOfConnections(this.gameID);
    if (nConnections === 0) {
      backend.setPlayerID(this.gameID, Player.Black, userConnection.ID);
      backend.publishPlayerType(this.gameID, userConnection, Player.Black);
    }
    else if (nConnections === 1) {
      backend.setPlayerID(this.gameID, Player.White, userConnection.ID);
      backend.publishPlayerType(this.gameID, userConnection, Player.White);
    }
    backend.incrementNumberOfConnections(this.gameID);
  }
}

export class MoveMessage extends Message {
  gameID: string;
  move: Move;

  constructor(gameID: string, move: Move) {
    super()
    this.gameID = gameID;
    this.move = move;
  }

  async execute(backend: Backend, userConnection: UserConnection): Promise<void> {
    let nextPlayer = await backend.getNextPlayer(this.gameID);
    let nextPlayerID = await backend.getPlayerID(this.gameID, nextPlayer);
    let gameStage = await backend.getGameStage(this.gameID);
    if (nextPlayerID === userConnection.ID && gameStage === GameStage.Play) {
      let currentBoard = await backend.getBoard(this.gameID);
      let updatedGameState = currentBoard.updateBoard(this.move);
      let validMove = updatedGameState !== null;
      let correctPlayer = nextPlayer === getPlayer(this.move.player);
      let repeatedPosition = await backend.isBoardInHistory(this.gameID, updatedGameState.board);
      if (validMove && correctPlayer && !repeatedPosition) {
        backend.appendMoveToHistory(this.gameID, this.move);
        backend.appendBoardToHistory(this.gameID, updatedGameState.board);
        backend.setBoard(this.gameID, updatedGameState.board);
        backend.updateNextPlayer(this.gameID);
        backend.updateScore(this.gameID, nextPlayer, updatedGameState.score);
        backend.publishMove(
          this.gameID, 
          this.move, 
          updatedGameState.board,
          await backend.getScore(this.gameID, Player.Black),
          await backend.getScore(this.gameID, Player.White)
        );
      }
      else {
        console.log(`Warning: invalid move: validMove = ${validMove}; correctPlayer = ${correctPlayer}; repeatedPosition = ${repeatedPosition}`)  
    }
    }
    else {
      console.log(`Warning: move from ID ${userConnection.ID}; expected ${nextPlayerID}`);
      console.log(`Warning: game stage is ${gameStage}`);
    }
  }
}

export class PassMessage extends Message {
  gameID: string;

  constructor(gameID: string) {
    super()
    this.gameID = gameID;
  }
  async execute(backend: Backend, userConnection: UserConnection): Promise<void> {
    let nextPlayer = await backend.getNextPlayer(this.gameID);
    let nextPlayerID = await backend.getPlayerID(this.gameID, nextPlayer);
    let gameStage = await backend.getGameStage(this.gameID);
    if (nextPlayerID === userConnection.ID && gameStage === GameStage.Play) {
      backend.appendMoveToHistory(this.gameID, null);
      backend.updateNextPlayer(this.gameID);
      if (await backend.getNthLastMove(this.gameID, 2) === null) { // if 2 passes in a two, go to mark dead
        backend.setGameStage(this.gameID, GameStage.MarkDead);
        backend.publishMarkDeadStage(this.gameID);
      }
      backend.publishPass(this.gameID, nextPlayer);
    }
  }
}

export class MarkDeadMessage extends Message {
  gameID: string;
  deadStones: Position[];

  constructor(gameID: string, deadStones: Position[]) {
    super();
    this.gameID = gameID;
    this.deadStones = deadStones;
  }

  async execute(backend: Backend, userConnection: UserConnection): Promise<void> {
    let gameStage = await backend.getGameStage(this.gameID);
    let blackID = await backend.getPlayerID(this.gameID, Player.Black);
    let whiteID = await backend.getPlayerID(this.gameID, Player.White);
    let player = userConnection.ID === blackID ? Player.Black : (userConnection.ID == whiteID ? Player.White : null);
    if (player !== null && gameStage === GameStage.MarkDead) {
      let isGroupDead = await backend.isStoneMarkedDead(this.gameID, this.deadStones[0], player);
      backend.markGroupDead(this.gameID, this.deadStones, player, !isGroupDead);
      backend.publishMarkDeadStones(this.gameID, this.deadStones, player, !isGroupDead);
    }
  }

}

export class ConfirmDeadMessage extends Message {
  gameID: string;

  constructor(gameID: string) {
    super();
    this.gameID = gameID;
  }

  async execute(backend: Backend, userConnection: UserConnection): Promise<void> {
    let gameStage = await backend.getGameStage(this.gameID);
    let blackID = await backend.getPlayerID(this.gameID, Player.Black);
    let whiteID = await backend.getPlayerID(this.gameID, Player.White);
    let player = userConnection.ID === blackID ? Player.Black : (userConnection.ID == whiteID ? Player.White : null);
    let deadStonesMatch = await backend.doDeadStonesMatch(this.gameID);
    if (player !== null && gameStage === GameStage.MarkDead && deadStonesMatch) {
      let opponent = player === Player.Black ? Player.White : Player.Black;
      let opponentConfirmedDead = await backend.getHasConfirmedDeadStones(this.gameID, opponent);
      if (opponentConfirmedDead) { // end
        let board = await backend.getBoard(this.gameID);
        let deadStones = await backend.getDeadStones(this.gameID, Player.Black);
        let territory = board.getTerritory(deadStones);
        let blackCaptureScore = await backend.getScore(this.gameID, Player.Black);
        let blackDeadStoneScore = deadStones
          .map((position) => board.board[position])
          .filter(piece => piece === Cell.White)
          .length;
        let blackTerritoryScore = territory.filter(a => a === Cell.Black).length;
        let blackTotalScore = blackCaptureScore + blackDeadStoneScore + blackTerritoryScore;
        let whiteCaptureScore = await backend.getScore(this.gameID, Player.White);
        let whiteDeadStoneScore = deadStones
          .map((position) => board.board[position])
          .filter(piece => piece === Cell.Black)
          .length;
        let whiteTerritoryScore = territory.filter(a => a === Cell.White).length;
        let whiteTotalScore = whiteCaptureScore + whiteDeadStoneScore + whiteTerritoryScore;
        backend.publishEndOfGame(this.gameID, territory, blackTotalScore, whiteTotalScore);
      }
      else {
        backend.setHasConfirmedDeadStones(this.gameID, player, true);
        backend.publishConfirmDeadStones(this.gameID, player);
      }
    }

  }
}

export class ChatMessage extends Message {
  gameID: string;
  message: string;

  constructor(gameID: string, message: string) {
    super();
    this.gameID = gameID;
    this.message = message;
  }
  async execute(backend: Backend, userConnection: UserConnection) {
    let blackID = await backend.getPlayerID(this.gameID, Player.Black);
    let whiteID = await backend.getPlayerID(this.gameID, Player.White);
    let player = userConnection.ID === blackID ? Player.Black : (userConnection.ID == whiteID ? Player.White : null);
    if (player !== null) {
      backend.sendChatMessage(this.gameID, player, this.message)
    }
  }
}

export class InvalidMessage extends Message {
  message: any;

  constructor(message: any) {
    super();
    this.message = message;
  }

  execute(backend: Backend) {
    console.log(`Invalid message: ${this.message}`);
  }
}

export class MessageFactory {
  static create(message: any): Message {
      if (message.type === "join") {
        return new JoinMessage(message.gameID);
      }
      else if (message.type === "move") {
        return new MoveMessage(message.gameID, message.userID);
      }
      else if (message.type ==="pass") {
        return new PassMessage(message.gameID);
      }
      else if (message.type === "deadGroup") {
        return new MarkDeadMessage(message.gameID, message.deadStones);
      }
      else if (message.type === "confirmDead") {
        return new ConfirmDeadMessage(message.gameID);
      }
      else if (message.type === "message") {
        return new ChatMessage(message.gameID, message.message);
      }
      else {
        return new InvalidMessage(`Invalid message type: ${message.type}`);
      }
  }
}

abstract class UserConnection {
  ID: string;

  constructor(ID: string) {
    this.ID = ID;
  }

  abstract subscribe(gameID: string): void;
}

class RedisUserConnection extends UserConnection {
  redis: Redis;

  constructor(ID: string, onMessage: (channel: string, message: string) => void) {
    super(ID);
    this.redis = new Redis(6379, "redis");
    this.redis.on("message", onMessage);
  }
  subscribe(gameID: string) {
    this.redis.subscribe(gameID);
    this.redis.subscribe(`${gameID}:${this.ID}`);
  }
}

export abstract class Backend {
  abstract isActiveGame(gameID: string): Promise<boolean>;
  abstract createGame(gameID: string): void;
  abstract getNumberOfConnections(gameID: string): Promise<number>;
  abstract incrementNumberOfConnections(gameID: string): void;
  abstract getPlayerID(gameID: string, player: Player): Promise<string>;
  abstract getNextPlayer(gameID: string): Promise<Player>;
  abstract updateNextPlayer(gameID: string): void;
  abstract getGameStage(gameID: string): Promise<GameStage>;
  abstract setGameStage(gameID: string, gameStage: GameStage): void;
  abstract setPlayerID(gameID: string, player: Player, playerID: string): void;
  abstract subscribeToGame(gameID: string, userConnection: UserConnection): void; 
  abstract isBoardInHistory(gameID: string, board: Board): Promise<boolean>;
  abstract getScore(gameID: string, player: Player): Promise<number>;
  abstract updateScore(gameID: string, player: Player, score: number): void;
  abstract getBoard(gameID: string): Promise<Board>;
  abstract setBoard(gameID: string, board: Board): void;
  abstract appendBoardToHistory(gameID: string, board:Board): void;
  abstract appendMoveToHistory(gameID: string, move: Move | null): void;
  abstract getNthLastMove(gameID: string, n: number): Promise<Move | null>;
  abstract isStoneMarkedDead(gameID: string, position: Position, player: Player): Promise<boolean>;
  abstract markGroupDead(gameID: string, group: Position[], player: Player, mark: boolean): void;
  abstract getHasConfirmedDeadStones(gameID: string, player: Player): Promise<boolean>;
  abstract setHasConfirmedDeadStones(gameID: string, player: Player, value: boolean): void;
  abstract doDeadStonesMatch(gameID: string): Promise<boolean>;
  abstract getDeadStones(gameID: string, player: Player): Promise<Position[]>;
  abstract sendChatMessage(gameID: string, player: Player, message: string): void;
  abstract createConnection(userID: string, onMessage: (channel: string, message: string) => void): UserConnection;
  abstract publishPlayerType(gameID: string, userConnection: UserConnection, player: Player): void;
  abstract publishMove(gameID: string, move: Move, board: Board, blackScore: number, whiteScore: number): void;
  abstract publishPass(gameID: string, player: Player): void;
  abstract publishMarkDeadStage(gameID: string): void;
  abstract publishMarkDeadStones(gameID: string, group: Position[], player: Player, mark: boolean): void;
  abstract publishConfirmDeadStones(gameID: string, player: Player): void;
  abstract publishEndOfGame(gameID: string, territory: any, blackScore: number, whiteScore: number): void;
}

export class RedisBackend extends Backend {

  redis: Redis; 

  constructor() {
    super();
    this.redis = new Redis(6379, "redis");
  }

  async isActiveGame(gameID: string): Promise<boolean> {
    return await this.redis.get(gameID) !== null;
  }

  createGame(gameID: string): void {
    this.redis.mset(
       gameID,  1,
       `${gameID}:numConnections`, 0,
       `${gameID}:nextPlayer`, Player.Black,
       `${gameID}:gameStage`, GameStage.Play,
       `${gameID}:board`, "0".repeat(9*9)
    );
  }

  async getNumberOfConnections(gameID: string): Promise<number> {
    let nConnections = await this.redis.get(`${gameID}:numConnections`);
    if (nConnections === null) {
        throw Error(`numConnections for game ${gameID} is null`);
    }
    else {
        return Number(nConnections);
    }
  }

  incrementNumberOfConnections(gameID: string): void {
    this.redis.incr(`${gameID}:numConnections`);
  }

  async getPlayerID(gameID: string, player: Player): Promise<string> {
    let playerID = await this.redis.get(`${gameID}:playerID:${player}`);
    if (playerID === null) {
      throw Error(`Player ID ${playerID} not found`);
    }
    else {
      return playerID;
    }
  }

  async getNextPlayer(gameID: string): Promise<Player> {
    let nextPlayer = await this.redis.get(`${gameID}:nextPlayer`);
    return nextPlayer === '0' ? Player.Black : Player.White;
  }

  async setNextPlayer(gameID:string, player: Player) {
    this.redis.set(`${gameID}:nextPlayer`, player);
  }

  async updateNextPlayer(gameID: string): Promise<void> {
    let nextPlayer = await this.getNextPlayer(gameID);
    let updatedNextPlayer = nextPlayer === Player.Black ? Player.White : Player.Black;
    this.setNextPlayer(gameID, updatedNextPlayer);
  }

  async getGameStage(gameID: string): Promise<GameStage> {
    let gameStageStr = await this.redis.get(`${gameID}:gameStage`); 
    let gameStage: GameStage;
    switch(gameStageStr) {
      case "0":
        gameStage = GameStage.Play;
        break;
      case "1":
        gameStage = GameStage.MarkDead;
        break;
      case "2":
        gameStage = GameStage.Over;
        break;
    }
    return gameStage!;
  }

  setGameStage(gameID: string, gameStage: GameStage): void {
    this.redis.set(`${gameID}:gameStage`, gameStage); 
  }

  setPlayerID(gameID: string, player: Player, playerID: string): void {
    this.redis.set(`${gameID}:playerID:${player}`, playerID);
  }

  async subscribeToGame(gameID: string, userConnection: UserConnection): Promise<void> {
    userConnection.subscribe(gameID);
  }

  async isBoardInHistory(gameID: string, board: Board): Promise<boolean> {
    let boardInHistory = await this.redis.hexists(`${gameID}:boardHistory`, board.serialise());
    return Boolean(boardInHistory);
  }

  async getScore(gameID: string, player: Player): Promise<number> {
    let score = await this.redis.get(`${gameID}:score:${player}`);
    return Number(score);
  }

  updateScore(gameID: string, player: Player, score: number): void {
    this.redis.set(`${gameID}:score:${player}`, score);
  }

  async getBoard(gameID: string): Promise<Board> {
    let board = await this.redis.get(`${gameID}:board`);
    if (board === null) {
      throw Error(`Value 'board' in game ${gameID} is null`);
    }
    else {
      return Board.deserialise(board);
    }
  }

  setBoard(gameID: string, board: Board): void {
    this.redis.set(`${gameID}:board`, board.serialise());
  }

  appendBoardToHistory(gameID: string, board: Board): void {
    this.redis.hset(`${gameID}:history`, board.serialise(), 1);
  }

  appendMoveToHistory(gameID: string, move: Move | null): void {
    if (move === null) {
      this.redis.rpush(`${gameID}:moves`, "pass");
    }
    else {
      this.redis.rpush(`${gameID}:moves`, move.position);
    }
  }
  
  async getNthLastMove(gameID: string, n: number): Promise<Move | null> {
    let move = (await this.redis.lrange(`${gameID}:moves`, -n, -n))[0];
    let nMoves = Number(await this.redis.llen(`${gameID}:moves`));
    let player = nMoves % 2 === 0 ? Cell.Black : Cell.White;
    if (move === "pass") {
      return null;
    }
    else {
      return new Move(Number(move), player);
    }
  }

  async isStoneMarkedDead(gameID: string, position: number, player: Player): Promise<boolean> {
    let markedDead = await this.redis.sismember(`${gameID}:deadStones:${player}`, position);
    return markedDead === 1
  }

  markGroupDead(gameID: string, group: Position[], player: Player, mark: boolean): void {
    if (mark) {
      this.redis.sadd(`${gameID}:deadStones:${player}`, ...group);
    }
    else {
      this.redis.srem(`${gameID}:deadStones:${player}`, ...group);
    }
  }

  async getHasConfirmedDeadStones(gameID: string, player: Player): Promise<boolean> {
    return Boolean(await this.redis.get(`${gameID}:confirmedDead:${player}`));
  }

  setHasConfirmedDeadStones(gameID: string, player: Player, value: boolean): void {
    this.redis.set(`${gameID}:confirmedDead:${player}`, Number(value));
  }

  async doDeadStonesMatch(gameID: string): Promise<boolean> {
    let intersectionSize = await this.redis.sintercard(2, `${gameID}:deadStones:black`, `${gameID}:deadStones:white`)
    let blackSize = await this.redis.scard(`${gameID}:deadStones:black`);
    let whiteSize = await this.redis.scard(`${gameID}:deadStones:white`);
    return blackSize === whiteSize && blackSize === intersectionSize;
  }

  async getDeadStones(gameID: string, player: Player): Promise<Position[]> {
    return (await this.redis.smembers(`${gameID}:deadStones:${player}`)).map(Number);
  }

  sendChatMessage(gameID: string, player: Player, message: string): void {
    let playerString = player === Player.Black ? "black" : "white";
    this.redis.publish(`${gameID}`, JSON.stringify({"type": "chatMessage", "message": message, "sender": playerString}));
  }

  publishPlayerType(gameID: string, userConnection: UserConnection, player: Player): void {
    this.redis.publish(`${gameID}:${userConnection.ID}`, JSON.stringify({
      "type": "setPlayerType",
      "player": player
    }))
  }

  publishMove(gameID: string, move: Move, board: Board, blackScore: number, whiteScore: number) {
    this.redis.publish(`${gameID}`, JSON.stringify({
      "type": "move", 
      "board": board.serialise(), 
      "position": move.position, 
      "blackScore": blackScore, 
      "whiteScore": whiteScore
    }));
  }

  publishPass(gameID: string, player: Player): void {
    this.redis.publish(`${gameID}`, JSON.stringify({
      "type": "pass",
      "player": player
    }));
  }
  
  publishMarkDeadStage(gameID: string): void {
    this.redis.publish(`${gameID}`, JSON.stringify({
      "type": "markDeadStage"
    }));
  }

  publishMarkDeadStones(gameID: string, group: Position[], player: Player, mark: boolean): void {
    this.redis.publish(`${gameID}`, JSON.stringify({
      "type": "markGroupDead",
      "player": player,
      "group": group,
      "mark" : mark
    }));
  }
  
  publishConfirmDeadStones(gameID: string, player: Player): void {
    this.redis.publish(`${gameID}`, JSON.stringify({
      "type": "confirmDead",
      "player": player
    }));
  }

  publishEndOfGame(gameID: string, territory: any, blackScore: number, whiteScore: number): void {
    this.redis.publish(`${gameID}`, JSON.stringify({
      "type": "end",
      "territory": territory,
      "blackScore": blackScore,
      "whiteScore": whiteScore
    }));
  }

  createConnection(userID: string, onMessage: (channel: string, message: string) => void): UserConnection {
    return new RedisUserConnection(userID, onMessage);
  }
}