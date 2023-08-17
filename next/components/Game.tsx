import { useState, useEffect, useImperativeHandle } from 'react';
import { io } from "socket.io-client";
import styles from 'styles/Page.module.css';
import * as Go from "@/lib/Go";
import { ChatMessage, GameStage } from '@/lib/Utils';
import Board from './Board';
import OpponentTimer from './OpponentTimer';
import PlayerTimer from './PlayerTimer';
import PassConfirmButton from './PassConfirmButton';
import History from './History';
import Chat from './Chat';

const BACKEND_SOCKET_HOST = process.env.NEXT_PUBLIC_BACKEND_SOCKET_HOST || "localhost";
const BACKEND_SOCKET_PORT = process.env.NEXT_PUBLIC_BACKEND_SOCKET_PORT || "80";

enum Player {
  Black = 1, // for consistency with Cell where 0 is Empty
  White
}

export default function Game({ gameID }: {gameID: string}) {
  const [websocket, setWebsocket] = useState(null);
  const [playerType, setPlayerType] = useState<number>(null);
  const [gridSize, setGridSize] = useState<number>(null);
  const [handicap, setHandicap] = useState<number>(null);
  const [komi, setKomi] = useState<number>(null);
  const [history, setHistory] = useState<Go.Board[]>([]);
  const [moveHistory, setMoveHistory] = useState<number[]>([]);
  const [currentMove, setCurrentMove] = useState(0);
  const xIsNext = currentMove % 2 === 0;
  const [currentBoard, setCurrentBoard] = useState(null);
  const [blackScore, setBlackScore] = useState<number>(0);
  const [whiteScore, setWhiteScore] = useState<number>(0);
  const [messageHistory, setMessageHistory] = useState<ChatMessage[]>([]);
  const [gameStage, setGameStage] = useState<GameStage>(GameStage.Play);
  const [playerMarkedDead, setPlayerMarkedDead] = useState<boolean[]>(null);
  const [opponentMarkedDead, setOpponentMarkedDead] = useState<boolean[]>(Array(gridSize*gridSize).fill(false));
  const [confirmDeadButtonActive, setConfirmDeadButtonActive] = useState<boolean>(true);
  const [opponentConfirmedDead, setOpponentConfirmedDead] = useState<boolean>(false);
  const [territory, setTerritory] = useState<Go.Cell[]>(null);
  let playerScore, opponentScore;
  console.log(`render game: gameID: ${gameID}`);
  if (playerType === Player.Black) {
    playerScore = blackScore;
    opponentScore = whiteScore;
  }
  else if (playerType === Player.White) {
    playerScore = whiteScore;
    opponentScore = blackScore;
  }

  useEffect(() => {
    console.log("Initialising socket")
    const newWebsocket = io(`http://${BACKEND_SOCKET_HOST}:${BACKEND_SOCKET_PORT}/ws`, { autoConnect: false, path: '/ws/socket.io/'});
    setWebsocket(newWebsocket);

    let sessionID = sessionStorage.getItem("sessionID");
    if (sessionID) {
      if (sessionStorage.getItem("gameID") === gameID) { // check that stored sessionID is for the current game - otherwise playing a new game in the same tab won't work
        newWebsocket.auth = { sessionID };
      }
      else {
        sessionID = null; // we are in a new game - annul session to trigger join
      }
    }

    newWebsocket.onAny((eventName, ...args) => {
      console.log(eventName, ...args);
    });

    newWebsocket.on("connect_error", (err) => { console.log(err.message) });

    newWebsocket.on("session", ({sessionID}) => {
      newWebsocket.auth = { sessionID };
      sessionStorage.setItem("sessionID", sessionID);
      sessionStorage.setItem("gameID", gameID); 

      console.log("emit gameinfo")
      newWebsocket.emit("gameInfo",
        gameID
      );
    });

    newWebsocket.on("setGameInfo", ({ player, boardSize, handicap, komi, moveHistory, board, blackScore, whiteScore, blackMarkedDead, whiteMarkedDead, territory }) => {
      setPlayerType(prevPlayer => player);
      setGridSize(_ => boardSize);
      setHandicap(_ => handicap);
      setKomi(_ => komi);
      setBlackScore(blackScore);
      setWhiteScore(whiteScore);
      setMoveHistory(moveHistory.map(m => m.position));
      let gridSize = boardSize;
      let history = [new Go.Board(Array(gridSize*gridSize).fill(Go.Cell.Empty))];
      let tempBoard = history[0];
      let index = 0;
      for (let move of moveHistory) {
        console.log(`Redoing history, move ${index}: `, move);
        let newBoard = tempBoard.updateBoard(move).board;
        console.log("Result: ", newBoard);
        history.push(newBoard);
        tempBoard = newBoard;
        index += 1;
      }
      setHistory(prevHistory => history);
      console.log(history);
      setCurrentMove(moveHistory.length);
      setCurrentBoard(Go.Board.deserialise(board));
      if (player === Player.Black) {
        setPlayerMarkedDead(blackMarkedDead);
        setOpponentMarkedDead(whiteMarkedDead);
      } else {
        setPlayerMarkedDead(whiteMarkedDead);
        setOpponentMarkedDead(blackMarkedDead);
      }
      setTerritory(territory === null ? Array(gridSize*gridSize).fill(Go.Cell.Empty) : territory);
    });

    newWebsocket.connect();

    if (!sessionID) { // sessionID will be non-null if refreshing, in which case we don't want to re-join
      newWebsocket.emit("join",
        gameID
      );
    }

    return () => {
      console.log("Closing socket");
      newWebsocket.close()
    }
  }, []);

  useEffect(() => {
    if (websocket) {
      websocket.on("move", ({ board, position, blackScore, whiteScore }) => {
          let nextBoard = new Go.Board(board.split("").map(Number));
          setMoveHistory(prevMoveHistory => [...prevMoveHistory.slice(), position]);
          setHistory(prevHistory => [...prevHistory.slice(), nextBoard]);
          setBlackScore(prevBlackScore => blackScore);
          setWhiteScore(prevWhiteScore => whiteScore);
          setCurrentMove(prevMove => prevMove + 1);
          setCurrentBoard(nextBoard);
      });
      websocket.on("pass", () => {
        setMoveHistory(prevMoveHistory => [...prevMoveHistory.slice(), -1]);
        setHistory(prevHistory => [...prevHistory.slice(), prevHistory[prevHistory.length-1]]);
        setCurrentMove(prevMove => prevMove + 1);
      });
      websocket.on("markDeadStage", () => {
        setGameStage(GameStage.MarkDead);
        setMessageHistory(prevHistory => [...prevHistory.slice(), {message: "Both players have passed. Please mark dead stones." , sender: "server"}]);
      });
      websocket.on("markGroupDead", ({ player, group, mark }) => {
        console.log("playerType: ", playerType, "; player: ", player);
        if (player === playerType) { 
          setPlayerMarkedDead(prevPlayerMarkedDead => {
            let nextPlayerMarkedDead = prevPlayerMarkedDead.slice();
            group.forEach(position => {nextPlayerMarkedDead[position] = mark});
            return nextPlayerMarkedDead;
          });
        }
        else {
          setOpponentMarkedDead(prevOpponentMarkedDead => {
            let nextOpponentMarkedDead = prevOpponentMarkedDead.slice();
            group.forEach(position => {nextOpponentMarkedDead[position] = mark});
            return nextOpponentMarkedDead;
          });
          setConfirmDeadButtonActive(true);
        }
      });
      websocket.on("confirmDead", ({ player }) => {
        if (player !== playerType) {
          setOpponentConfirmedDead(true);
        }
        else {
          setConfirmDeadButtonActive(false);
        }
      });
      websocket.on("end", ({ territory, blackScore, whiteScore }) => {
        setGameStage(GameStage.End);
        setTerritory(territory);
        setMessageHistory(prevHistory => [...prevHistory.slice(), {message: `Game over\nBlack:\t${blackScore}\nWhite:\t${whiteScore}`, sender: "server"}]);
        console.log(`Game over\nBlack:\t${blackScore}\nWhite:\t${whiteScore}`);
      });
      websocket.on("chatMessage", ({ message, sender }) => {
        setMessageHistory(prevHistory => [...prevHistory.slice(), { message, sender }]);
      });
    }
  }, [playerType]);

  useEffect(() => {
    if (gameStage === GameStage.MarkDead) {
      let flag = true;
      let p = playerMarkedDead.slice().sort()
      let o = opponentMarkedDead.slice().sort();
      for (let i=0; i < p.length; i++) {
        if (p[i] != o[i]) {
          flag = false;
          setConfirmDeadButtonActive(false);
          break;
        }
      }
      if (flag) {
        setConfirmDeadButtonActive(true);
      }
    }
  }, [playerMarkedDead, opponentMarkedDead]);

  function handlePlay(move: Go.Move) {
    websocket.emit("move",
      gameID,
      move
    );
  }

  function handlePass() {
    websocket.emit("pass",
      gameID
    );
  }

  function handleMarkDead(position: number) {
    websocket.emit("deadGroup",
      gameID,
      currentBoard.getGroup(position)
    );
  }

  function handleConfirmDead() {
    websocket.emit("confirmDead",
      gameID,
      playerType
    );
  }

  function jumpTo(nextMove: number) {
    setCurrentMove(nextMove);
  }

  function handleChat(message: string) {
    websocket.emit("chatMessage",
      gameID,
      message
    );
  }

  return (
    <div className={styles.game}>
      <div className={styles.gameBoard}>
        <div className={styles.tableTop}>
          <div className={styles.boardAndTimers}>
            <Board xIsNext={xIsNext} gameStage={gameStage} board={currentBoard} latestMove={moveHistory[currentMove-1]} playerMarkedDead={playerMarkedDead} opponentMarkedDead={opponentMarkedDead} territory={territory} onPlay={handlePlay} onMarkDead={handleMarkDead} gridSize={gridSize} />
            <div className={styles.timers}>
              <div className={styles.opponentInfo}>
                <div className={styles.opponentNametag}>
                  <img height="20" width="20" src={playerType === Player.Black ? "/white_piece.svg" : "/black_piece.svg"} />
                  <div>Anonymous</div>
                </div>
                <OpponentTimer score={opponentScore} />
              </div>
              <div className={styles.playerInfo}>
                <PlayerTimer score={playerScore} />
                <PassConfirmButton gameStage={gameStage} active={gameStage !== GameStage.MarkDead || confirmDeadButtonActive} handlePass={handlePass} handleConfirmDead={handleConfirmDead} />
                <div className={styles.playerNametag}>
                  <div>Anonymous</div>
                  <img height="20" width="20" src={playerType === Player.Black ? "/black_piece.svg" : "/white_piece.svg"} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className={styles.utilities}>
        <History moves={moveHistory} gridSize={gridSize} />
        <Chat messageHistory={messageHistory} sendMessage={handleChat} />
      </div>
    </div>
  );
}
