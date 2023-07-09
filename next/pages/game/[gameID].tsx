import { useState, useEffect, useImperativeHandle } from 'react';
import { useRouter } from 'next/router';
import { io } from "socket.io-client";
import styles from 'styles/Page.module.css';
import * as Go from "@/lib/Go";

enum GameStage {
  Play,
  MarkDead,
  End
}

type ChatMessage = {
  message: string,
  sender: string
}

function Square({ 
  value, 
  playerMarkedDead, 
  opponentMarkedDead, 
  territory,
  onSquareClick 
}: {
  value: Go.Cell, 
  playerMarkedDead: boolean, 
  opponentMarkedDead: boolean, 
  territory: Go.Cell,
  onSquareClick: () => void
}) {
  const imgfn = value === Go.Cell.Black ? 'black_piece.svg' : (value === Go.Cell.White ? 'white_piece.svg' : '');
  return (
    <button className={styles.square} onClick={onSquareClick}>
      { (imgfn === '') ? null : (<img className={styles.piece} src={"/" + imgfn} />) }
      { playerMarkedDead ? (<div className={styles.playerMarkedDead}>X</div>) : null }
      { opponentMarkedDead ? (<div className={styles.opponentMarkedDead}>X</div>) : null }
      { (territory === Go.Cell.Empty) ? null : (<div className={territory === Go.Cell.Black ? styles.blackTerritory : styles.whiteTerritory}>o</div>) }
    </button>
  );
}

function Board({ 
  xIsNext, 
  gameStage,
  board, 
  playerMarkedDead, 
  opponentMarkedDead, 
  territory,
  onPlay, 
  onMarkDead,
  gridSize 
}: {
  xIsNext: boolean, 
  gameStage: GameStage,
  board: Go.Board,
  playerMarkedDead: boolean[],
  opponentMarkedDead: boolean[],
  territory: Go.Cell[],
  onPlay: (move: Go.Move) => void, 
  onMarkDead: (position: number) => void,
  gridSize: number
}) {
  function handleClick(position: number) {
    if (gameStage === GameStage.MarkDead && board.board[position] != Go.Cell.Empty) {
      onMarkDead(position);
    }
    else if (gameStage === GameStage.Play) {
      const move = new Go.Move(position, xIsNext ? Go.Cell.Black : Go.Cell.White);
      const nextBoard = board.updateBoard(move);
      if (nextBoard !== null) {
        onPlay(move);
      }
    }
  }

  const squares = [...Array(gridSize*gridSize).keys()].map((i) => {
    return <Square key={i} value={board.board[i]} playerMarkedDead={playerMarkedDead[i]} opponentMarkedDead={opponentMarkedDead[i]} territory={territory[i]} onSquareClick={() => handleClick(i)} />
  });

  return (
    <div className={styles.boardContainer}>
      <div className={styles.board}>
        { squares }
      </div>
    </div>
  );
}

function Chat({ messageHistory, sendMessage }: {messageHistory: ChatMessage[], sendMessage: (message: string) => void}) {
  const [message, setMessage] = useState('');

  const handleChange = (event) => {
    setMessage(event.target.value);
  };

  const handleKeyDown = (event) => {
    if (event.key == "Enter" && message.length > 0) {
      console.log(message);
      sendMessage(message);
      setMessage('');
    }
  }

  const messages = messageHistory.map((message, index) => {
    return (
      <li className={styles.chatMessage} key={index}>
        <span className={styles.chatSender}>{'[' + message.sender + "]: "}</span>{message.message}
      </li>
    );
  });

  return (
    <div className={styles.chat}>
      <ol className={styles.chatHistory}>{messages}</ol>
      <input 
        className={styles.chatBox}
        type="text" 
        id="chat" 
        name="chat" 
        onChange={handleChange}
        onKeyDown={handleKeyDown} 
        value={message} 
        maxLength={140} 
        placeholder="Send a message" 
      /> 
    </div>
  );
}

function PlayerTimer({score}: {score: number}) {
  return (
    <div className={`${styles.playerTimer} ${styles.timer}`}>
      <span>--:--</span>
      <span>{score}</span>
    </div>
  );
}

function OpponentTimer({score}: {score: number}) {
  return (
    <div className={`${styles.opponentTimer} ${styles.timer}`}>
      <span>--:--</span>
      <span>{score}</span>
    </div>
  );
}

function PassConfirmButton({gameStage, handlePass, handleConfirmDead}: {gameStage: GameStage, handlePass: any, handleConfirmDead: any}) {
  if (gameStage === GameStage.Play) {
    return <button className={styles.passButton} onClick={handlePass}>Pass</button>
  } else {
    return <button className={styles.confirmDeadButton} onClick={handleConfirmDead}>Confirm dead groups</button>
  }
}

function History({moves, gridSize}: {moves: any[], gridSize: number}) {
  const history = moves
    .filter((value, idx) => idx % 2 == 0)
    .map((value, idx) => {
      let blackIdx = 2*idx + 1;
      let blackMove = (Math.floor(value / gridSize) + 1) + "-" + ((value % gridSize) + 1);
      let whiteIdx = 2*idx + 2;
      let whiteMove;
      if (whiteIdx <= moves.length) {
        let whiteValue = moves[whiteIdx-1];
        whiteMove = (Math.floor(whiteValue / gridSize) + 1) + "-" + ((whiteValue % gridSize) + 1);
      }
      return (
        <div className={styles.historyRow}>
          <div className={styles.historyIndex}>{blackIdx + '.'}</div>
          <div className={styles.historyMove}>{blackMove}</div>
          <div className={styles.historyIndex}>{whiteIdx + '.'}</div>
          <div className={styles.historyMove}>{whiteMove}</div>
        </div>
      )
    });
  return (
    <div className={styles.history}>
      {history}
    </div>
  )
}

function Game({ gameID }: {gameID: string}) {
  const [websocket, setWebsocket] = useState(null);
  const gridSize = 9;
  const [history, setHistory] = useState<Go.Board[]>([new Go.Board(Array(gridSize*gridSize).fill(Go.Cell.Empty))]);
  const [moveHistory, setMoveHistory] = useState<number[]>([]);
  const [currentMove, setCurrentMove] = useState(0);
  const xIsNext = currentMove % 2 === 0;
  const currentBoard = history[currentMove];
  const [blackScore, setBlackScore] = useState<number>(0);
  const [whiteScore, setWhiteScore] = useState<number>(0);
  const [messageHistory, setMessageHistory] = useState<ChatMessage[]>([]);
  const [gameStage, setGameStage] = useState<GameStage>(GameStage.Play);
  const [playerMarkedDead, setPlayerMarkedDead] = useState<boolean[]>(Array(gridSize*gridSize).fill(false));
  const [opponentMarkedDead, setOpponentMarkedDead] = useState<boolean[]>(Array(gridSize*gridSize).fill(false));
  const [confirmDeadButtonActive, setConfirmDeadButtonActive] = useState<boolean>(false);
  const [opponentConfirmedDead, setOpponentConfirmedDead] = useState<boolean>(false);
  const [territory, setTerritory] = useState<Go.Cell[]>(Array(gridSize*gridSize).fill(Go.Cell.Empty));
  const [playerType, setPlayerType] = useState<string>(null);
  let playerScore, opponentScore;
  if (playerType === "black") {
    playerScore = blackScore;
    opponentScore = whiteScore;
  }
  else if (playerType === "white") {
    playerScore = whiteScore;
    opponentScore = blackScore;
  }

  useEffect(() => {
    const newWebsocket = io("http://localhost:8998");
    setWebsocket(newWebsocket);

    newWebsocket.onAny((eventName, ...args) => {
      console.log(eventName, ...args);
    });

    newWebsocket.on("connect_error", (err) => { console.log(err.message) });

    newWebsocket.on("session", () => {
      // TODO
    });

    newWebsocket.once("setPlayerType", ({ player }) => {
      setPlayerType(prevPlayer => player);
    });

    if (gameID) {
      newWebsocket.emit("join",
        gameID
      );
    }
  }, [gameID]);

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
        console.log(`Game over\nBlack:\t${blackScore}\nWhite:\t${whiteScore}`);
      });
      websocket.on("chatMessage", ({ message, sender }) => {
        setMessageHistory(prevHistory => [...prevHistory.slice(), { message, sender }]);
      });
    }
  }, [playerType]);

  useEffect(() => {
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
            <Board xIsNext={xIsNext} gameStage={gameStage} board={currentBoard} playerMarkedDead={playerMarkedDead} opponentMarkedDead={opponentMarkedDead} territory={territory} onPlay={handlePlay} onMarkDead={handleMarkDead} gridSize={gridSize} />
            <div className={styles.timers}>
              <OpponentTimer score={opponentScore} />
              <div></div>
              <PassConfirmButton gameStage={gameStage} handlePass={handlePass} handleConfirmDead={handleConfirmDead} />
              <PlayerTimer score={playerScore} />
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

function Sidebar() {
  return (
    <div className={`${styles.sidebar} ${styles.placeholder}`}>
      <span>mahogo</span>
    </div>
  );
}

export default function Page() {
  const router = useRouter();
  console.log(router.query);
  let gameID = router.query.gameID;
  if (Array.isArray(gameID)) { // router.query.gameID can be string[], apparently
    return null;
  }
  return (
    <div className={styles.page}>
      <Sidebar />
      <Game gameID={gameID} />
    </div>
  );
}
