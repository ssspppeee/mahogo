import * as express from 'express';
import * as path from 'path';
import * as http from 'http';
import * as WebSocket from 'ws';
import { Redis } from "ioredis";
import { Cell, Move, Board } from "../../share/Go"

const redisPub = new Redis();
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// app.use(express.json());

class Game {
  connections: number;
  blackKey: string;
  whiteKey: string;
  blackNext: boolean;

  constructor(connections: number, blackKey: string, whiteKey: string, blackNext: boolean) {
    this.connections = connections;
    this.blackKey = blackKey;
    this.whiteKey = whiteKey;
    this.blackNext = blackNext;
  }
}

let activeGames = new Map();

async function isActiveGame(redisPub: any, gameID: string) {
  let gID = await redisPub.get(gameID);
  // console.log(`isActiveGame(${gameID}) -> ${gID}`);
  return gID !== null;
}

async function getActiveGame(redisPub: any, gameID: string) {
  let connectionsP = redisPub.get(`${gameID}:connections`);
  let blackKeyP = redisPub.get(`${gameID}:blackKey`);
  let whiteKeyP = redisPub.get(`${gameID}:whiteKey`);
  let blackNextP = redisPub.get(`${gameID}:blackNext`);
  const [connections, blackKey, whiteKey, blackNext] = await Promise.all([connectionsP, blackKeyP, whiteKeyP, blackNextP]);
  return new Game(connections, blackKey, whiteKey, blackNext);
}

function addParticipant(
  redisPub: any, 
  redisSub: any, 
  onMessage: any, 
  gameID: string, 
  ip: string, 
  participantType: string
) {
  if (participantType === "black" || participantType === "white") {
    redisPub.set(`${gameID}:${participantType}Key`, ip);
  }
  if (participantType === "black") {
    redisPub.set(`${gameID}:blackNext`, 1);
  }
  redisPub.incr(`${gameID}:connections`);
  redisSub.subscribe(gameID, (err: any, count: any) => {
    if (err !== null) {
      console.log(err);
    }
    if (count !== null) {
      // console.log(count)
    }
  });
  redisSub.on("message", onMessage);
}

async function isValid(gameID: string, board: Board, move: Move) {
  let boardScore = board.updateBoard(move);
  if (boardScore === null) {
    return false;
  }
  // console.log(JSON.stringify(boardScore));
  let duplicateState = await redisPub.hexists(`${gameID}:history`, boardScore.board.serialise());
  // console.log(`Legal move: ${boardScore !== null}; Repeat: ${duplicateState}`);
  return !duplicateState;
}

async function updateGame(redisPub: any, gameID: string, position: any | null, board: Board | null) {
  if (board === null) {
    redisPub.rpush(`${gameID}:moves`, "pass");
    let blackNext = await redisPub.get(`${gameID}:blackNext`);
    if (blackNext == 1) {
      redisPub.set(`${gameID}:blackNext`, 0);
    }
    else {
      redisPub.set(`${gameID}:blackNext`, 1);
    }
    redisPub.publish(`${gameID}`, JSON.stringify({"type": "pass"}));
  }
  else {
    redisPub.hset(`${gameID}:history`, board.serialise(), 1);
    redisPub.rpush(`${gameID}:moves`, position);
    let blackNext = await redisPub.get(`${gameID}:blackNext`);
    let newBoardScore;
    if (blackNext == 1) {
      newBoardScore = board.updateBoard(new Move(position, Cell.Black));
      redisPub.set(`${gameID}:blackNext`, 0);
    }
    else {
      newBoardScore = board.updateBoard(new Move(position, Cell.White));
      redisPub.set(`${gameID}:blackNext`, 1);
    }
    redisPub.publish(`${gameID}`, JSON.stringify({"type": "move", "board": newBoardScore.board.serialise(), "position": position}));
  }
}

async function updateChat(redisPub: any, gameID: string, message: string) {
  redisPub.publish(`${gameID}`, JSON.stringify({"type": "message", "message": message}));
}
  
wss.on("connection", (ws: WebSocket, req: any) => {
  const ip = req.socket.remoteAddress;
  let redisSub = new Redis();

  // client-to-server
  ws.on("message", async (data: any, isBinary: boolean) => {
    const message = isBinary ? data : data.toString();
    console.log("Message: ", message);
    let msg = JSON.parse(message);
    if (await isActiveGame(redisPub, msg.gameID)) {
      let game = await getActiveGame(redisPub, msg.gameID);
      console.log(`getActiveGame(${msg.gameID}): -> ${JSON.stringify(game)}`);
      if (msg.type === "join") {
        // join game
        if (game.connections == 0) {
          addParticipant(redisPub, redisSub, handleMessageToClient, msg.gameID, ip, "black");
        }
        else if (game.connections == 1) {
          addParticipant(redisPub, redisSub, handleMessageToClient, msg.gameID, ip, "white");
        }
        else {
          addParticipant(redisPub, redisSub, handleMessageToClient, msg.gameID, ip, "spectator");
        }
      }
      else if (msg.type === "move") {
        // make move
        if ((game.blackNext && ip === game.blackKey) ||
            (!game.blackNext && ip === game.whiteKey)) {
          // console.log("Move: check if valid");
          if (await isValid(msg.gameID, new Board(msg.board), msg.move)) {
            updateGame(redisPub, msg.gameID, msg.move.position, new Board(msg.board));
          }
        }
      }
      else if (msg.type ==="pass") {
        if ((game.blackNext && ip === game.blackKey) ||
            (!game.blackNext && ip === game.whiteKey)) {
          updateGame(redisPub, msg.gameID, null, null);
        }
      }
      else if (msg.type === "message") {
        updateChat(redisPub, msg.gameID, msg.message);
      }
    }
  });

  // server-to-client
  function handleMessageToClient(channel: string, message: string) {
    ws.send(message);
  }
});

/*
wss.on('connection', (ws: WebSocket) => {
  ws.on('message', (message: string) => {
    let messageJSON = JSON.parse(message);
    console.log('received: %s', messageJSON);
    if (activeGames.has(messageJSON.gameID)) {
      let game = activeGames.get(messageJSON.gameID);
      if (messageJSON.playerKey === game.p1key) {
        console.log("Received p1 move");
        game.history.push(messageJSON.move);
        console.log(`History of ${game.id}: ${game.history}`);
        ws.send(`Played move ${messageJSON.move}. History: ${game.history}`);
      }
      else if (messageJSON.playerKey === game.p2key) {
        console.log("Reeived p2 move");
        ws.send("Not player 2's turn yet.");
      }
      else {
        console.log("Receive other user move");
        ws.send("Invalid player key.");
      }
    }
  });
  ws.send(`Active games: ${Array.from(activeGames.keys())}`);
});
*/

server.listen(process.env.PORT || 8999, () => {
  console.log(`Server started :)`);
  redisPub.flushall();
  generateGame(redisPub);
});

function generateGameID(redisPub: any) {
  // TODO
  // maybe do xkcd-style four-word IDs
  return "abcdef";
}

function generateGame(redisPub: any) {
  let gameID = generateGameID(redisPub);
  redisPub.set(gameID, 1);
  redisPub.set(`${gameID}:connections`, 0);
  return gameID;
}

app.get('/', (req, res) => {
  console.log("Page accessed");
  let gameID = generateGame(redisPub);
  // res.sendFile(path.join(__dirname, "../../../../../frontend/build", "index.html"));
  res.redirect(`/game/${gameID}`);
});

app.get("/game/:gameID", (req, res) => {
  // res.send("tst");
  res.sendFile(path.join(__dirname, "../../../../../frontend/build", "index.html"));
});


app.use(express.static(path.join(__dirname, "../../../../../frontend/build/")));

/*
app.get('/', (req, res) => {
  // create game
  let game = "abcdef";
  activeGames.set(game, new Game(game));
  res.redirect(`/${game}`);
});

app.get('/:gameId', (req, res) => {
  const gameId = req.params.gameId;
  // join game
  if (!activeGames.has(gameId)) {
    res.send(`No active game named '${gameId}'`);
  }
  else {
    let game = activeGames.get(gameId);
    game.connections += 1;
    if (game.connections === 1) {
      res.send("p1key");
    }
    else if (game.connections === 2) {
      res.send("p2key");
    }
    else {
      res.send("spectatorkey");
    }
  }
});
*/

