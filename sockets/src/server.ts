import * as express from 'express';
import * as cors from 'cors';
import * as http from 'http';
import * as crypto from "crypto";
import { Server, Socket } from "socket.io";

import { Backend, ChatMessage, ConfirmDeadMessage, GameInfoMessage, JoinMessage, MarkDeadMessage, MessageFactory, MoveMessage, PassMessage, RedisBackend} from "./backend";
import { Redis } from 'ioredis';

const REDIS_HOST = process.env.REDIS_HOST || "localhost";
const REDIS_PORT = process.env.REDIS_PORT || "6379";
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:3000";

console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
const app = express();
app.use(cors());
app.use(express.json());
const apiServer = http.createServer(app);
const socketServer = http.createServer();
const io = new Server(socketServer, {
  cors: {
    origin: CORS_ORIGIN
  },
  connectionStateRecovery: {
    maxDisconnectionDuration: 5 * 60 * 1000,
    skipMiddlewares: false
  },
  path: '/ws/socket.io/'
}).of('/ws');

type Session = {
  userID: string,
  username: string,
  connected: boolean
}

abstract class SessionStore {
  abstract findSession(id: string): Promise<Session | null>;
  abstract saveSession(id: string, session: Session): void;
}

class InMemorySessionStore extends SessionStore {
  sessions: Map<string, Session>;

  constructor() {
    super();
    this.sessions = new Map();
  }

  async findSession(id: string): Promise<Session | null> {
    return await this.sessions.get(id)!;
  }

  saveSession(id: string, session: Session): void {
    this.sessions.set(id, session);
  }
}

class RedisSessionStore extends SessionStore {
  redis: Redis;
  
  constructor() {
    super();
    this.redis = new Redis(Number(REDIS_PORT), REDIS_HOST);
  } 

  async findSession(id: string): Promise<Session | null> {
    let userID = await this.redis.get(`${id}:userID`);
    if (userID) {
      return {
        userID,
        username: (await this.redis.get(`${id}:userName`))!,
        connected: true
      }
    }
    return null;
  }

  saveSession(id: string, session: Session): void {
    this.redis.set(`${id}:userID`, session.userID);
    this.redis.set(`${id}:username`, session.username);
  }
}
const sessionStorage = new RedisSessionStore();
const backend: Backend = new RedisBackend();

const randomID = (nBytes: number) => crypto.randomBytes(nBytes).toString("base64url");

interface SessionSocket extends Socket{
  sessionID?: string;
  userID?: string;
  username?: string;
}

io.use(async (socket: SessionSocket, next) => {
  console.log("Session ID: ", socket.handshake.auth.sessionID);
  const sessionID = socket.handshake.auth.sessionID;
  if (sessionID) {
    const session = await sessionStorage.findSession(sessionID);
    if (session) {
      socket.sessionID = sessionID;
      socket.userID = session.userID;
      socket.username = session.username;
      return next();
    }
  }
  let username = socket.handshake.auth.username;
  if (!username) {
    username = "Anonymous";
  }
  socket.sessionID = randomID(16);
  socket.userID = randomID(16);
  socket.username = username;
  next();
})

io.on("connection", async (socket: SessionSocket) => {
  console.log("socket: ", socket.sessionID, socket.userID);
  sessionStorage.saveSession(socket.sessionID!, {
    userID: socket.userID!,
    username: socket.username!,
    connected: true
  });

  function handleMessageToClient(channel: string, message: string) {
    // 'channel' argument is the Redis channel, i.e. gameID[:userID]
    // socket channel is the message type, i.e. "move", "pass", etc.
    console.log(`channel: ${channel}; message: ${message}`);
    let obj = JSON.parse(message);
    let type = obj.type
    delete obj.type;
    socket.emit(type, obj);
  }

  let userConnection = backend.createConnection(socket.userID!, handleMessageToClient); // null case handled by "use" middleware

  socket.onAny((eventName, ...args) => {
    console.log(eventName, ...args);
  })

  socket.on("join", (gameID) => {
    let msg = new JoinMessage(gameID);
    msg.execute(backend, userConnection);
  });

  socket.on("gameInfo", (gameID) => {
    let msg = new GameInfoMessage(gameID);
    msg.execute(backend, userConnection);
  });

  socket.on("move", (gameID, move) => {
    let msg = new MoveMessage(gameID, move);
    msg.execute(backend, userConnection);
  });

  socket.on("pass", (gameID) => {
    let msg = new PassMessage(gameID);
    msg.execute(backend, userConnection);
  });

  socket.on("deadGroup", (gameID, deadStones) => {
    let msg = new MarkDeadMessage(gameID, deadStones);
    msg.execute(backend, userConnection);
  });
  
  socket.on("confirmDead", (gameID) => {
    let msg = new ConfirmDeadMessage(gameID);
    msg.execute(backend, userConnection);
  });

  socket.on("chatMessage", (gameID, message) => {
    let msg = new ChatMessage(gameID, message);
    msg.execute(backend, userConnection);
  });

  socket.emit("session", {
    sessionID: socket.sessionID,
    userID: socket.userID
  });

})

socketServer.listen(8998, () => {
  console.log(`Socket server started on port ${8998}`);
})

app.post('/api/createGame', (req, res) => {
  let gameID = randomID(4);
  backend.createGame(gameID, req.body.boardSize, req.body.player, req.body.handicap, req.body.komi);
  console.log(`Create game: ${gameID}`);
  res.send(JSON.stringify({"gameID": gameID}));
})

app.listen(8999, () => {
  console.log(`API server started on port ${8999} (CORS enabled: origin ${CORS_ORIGIN})`);
});