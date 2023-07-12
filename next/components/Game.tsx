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

const BACKEND_HOST = "localhost";
const BACKEND_PORT = 8998;


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
  const currentBoard = history[currentMove];
  const [blackScore, setBlackScore] = useState<number>(0);
  const [whiteScore, setWhiteScore] = useState<number>(0);
  const [messageHistory, setMessageHistory] = useState<ChatMessage[]>([]);
  const [gameStage, setGameStage] = useState<GameStage>(GameStage.Play);
  const [playerMarkedDead, setPlayerMarkedDead] = useState<boolean[]>(null);
  const [opponentMarkedDead, setOpponentMarkedDead] = useState<boolean[]>(Array(gridSize*gridSize).fill(false));
  const [confirmDeadButtonActive, setConfirmDeadButtonActive] = useState<boolean>(false);
  const [opponentConfirmedDead, setOpponentConfirmedDead] = useState<boolean>(false);
  const [territory, setTerritory] = useState<Go.Cell[]>(null);
  let playerScore, opponentScore;
  if (playerType === 0) {
    playerScore = blackScore;
    opponentScore = whiteScore;
  }
  else if (playerType === 1) {
    playerScore = whiteScore;
    opponentScore = blackScore;
  }

  useEffect(() => {
    const newWebsocket = io(`http://${BACKEND_HOST}:${BACKEND_PORT}`, { autoConnect: false });
    
    const sessionID = sessionStorage.getItem("sessionID");
    if (sessionID) {
      newWebsocket.auth = { sessionID };
    }
    newWebsocket.connect();
    setWebsocket(newWebsocket);

    newWebsocket.onAny((eventName, ...args) => {
      console.log(eventName, ...args);
    });

    newWebsocket.on("connect_error", (err) => { console.log(err.message) });

    newWebsocket.on("session", ({sessionID}) => {
      newWebsocket.auth = { sessionID };
      sessionStorage.setItem("sessionID", sessionID);
    });

    newWebsocket.once("setGameInfo", ({ player, boardSize, handicap, komi }) => {
      setPlayerType(prevPlayer => player);
      setGridSize(_ => boardSize);
      setHandicap(_ => handicap);
      setKomi(_ => komi);
      setBlackScore(0);
      setWhiteScore(komi);
      let gridSize = boardSize;
      setHistory(prevHistory => [new Go.Board(Array(gridSize*gridSize).fill(Go.Cell.Empty))]);
      setPlayerMarkedDead(prevPlayerMarkedDead => Array(gridSize*gridSize).fill(false));
      setOpponentMarkedDead(prevOpponentMarkedDead => Array(gridSize*gridSize).fill(false));
      setTerritory(Array(gridSize*gridSize).fill(Go.Cell.Empty));
    });

    if (gameID && !sessionID) { // gameID is null on page load. sessionID will be non-null if refreshing, in which case we don't want to re-join
      newWebsocket.emit("join",
        gameID
      );
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
      for (let i=0; i < playerMarkedDead.length; i++) {
        if (playerMarkedDead[i] != opponentMarkedDead[i]) {
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
                  <img height="20" width="20" src={playerType === 0 ? "/white_piece.svg" : "/black_piece.svg"} />
                  <div>Anonymous</div>
                </div>
                <OpponentTimer score={opponentScore} />
              </div>
              <div className={styles.playerInfo}>
                <PlayerTimer score={playerScore} />
                <PassConfirmButton gameStage={gameStage} handlePass={handlePass} handleConfirmDead={handleConfirmDead} />
                <div className={styles.playerNametag}>
                  <div>Anonymous</div>
                  <img height="20" width="20" src={playerType === 0 ? "/black_piece.svg" : "/white_piece.svg"} />
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
