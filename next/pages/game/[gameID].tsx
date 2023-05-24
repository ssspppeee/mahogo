import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import styles from 'styles/Page.module.css';
import * as Go from "@/lib/Go";

function Square({ 
  value, 
  playerMarkedDead, 
  opponentMarkedDead, 
  onSquareClick 
}: {
  value: Go.Cell, 
  playerMarkedDead: boolean, 
  opponentMarkedDead: boolean, 
  onSquareClick: () => void
}) {
  const imgfn = value === Go.Cell.Black ? 'black_piece.png' : (value === Go.Cell.White ? 'white_piece.png' : '');
  return (
    <button className={styles.square} onClick={onSquareClick}>
      { (imgfn === '') ? null : (<img src={"/" + imgfn} />) }
      { playerMarkedDead ? (<div className={styles.playerMarkedDead}>X</div>) : null}
      { opponentMarkedDead ? (<div className={styles.opponentMarkedDead}>X</div>) : null}
    </button>
  );
}

function Board({ 
  xIsNext, 
  markDeadStage,
  board, 
  playerMarkedDead, 
  opponentMarkedDead, 
  onPlay, 
  onMarkDead,
  gridSize 
}: {
  xIsNext: boolean, 
  markDeadStage: boolean,
  board: Go.Board,
  playerMarkedDead: boolean[],
  opponentMarkedDead: boolean[],
  onPlay: (move: Go.Move) => void, 
  onMarkDead: (position: number) => void,
  gridSize: number
}) {
  function handleClick(position: number) {
    if (markDeadStage && board.board[position] != Go.Cell.Empty) {
      onMarkDead(position);
    }
    else {
      const move = new Go.Move(position, xIsNext ? Go.Cell.Black : Go.Cell.White);
      const nextBoard = board.updateBoard(move);
      if (nextBoard !== null) {
        onPlay(move);
      }
    }
  }

  const squares = [...Array(gridSize*gridSize).keys()].map((i) => {
    return <Square key={i} value={board.board[i]} playerMarkedDead={playerMarkedDead[i]} opponentMarkedDead={opponentMarkedDead[i]} onSquareClick={() => handleClick(i)} />
  });

  return (
    <div className={styles.boardContainer}>
      <div className={styles.board}>
        { squares }
      </div>
    </div>
  );
}

function Chat({ messageHistory, sendMessage }: {messageHistory: string[], sendMessage: (message: string) => void}) {
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
        <p>{message}</p>
      </li>
    );
  });

  return (
    <div className={styles.chat}>
      <ol className={styles.chatHistory}>{messages}</ol>
      <input 
        className="chatBox"
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
    <div className={`${styles.playerTimer} ${styles.placeholder}`}>
      <span>player timer</span>
      <span>{score}</span>
    </div>
  );
}

function OpponentTimer({score}: {score: number}) {
  return (
    <div className={`${styles.opponentTimer} ${styles.placeholder}`}>
      <span>opponent timer</span>
      <span>{score}</span>
    </div>
  );
}

function Game({ gameID }: {gameID: string}) {
  const [websocket, setWebsocket] = useState(null);
  const gridSize = 9;
  const [history, setHistory] = useState<Go.Board[]>([new Go.Board(Array(gridSize*gridSize).fill(Go.Cell.Empty))]);
  const [moveHistory, setMoveHistory] = useState<number[]>([-1]);
  const [currentMove, setCurrentMove] = useState(0);
  const xIsNext = currentMove % 2 === 0;
  const currentBoard = history[currentMove];
  const [blackScore, setBlackScore] = useState<number>(0);
  const [whiteScore, setWhiteScore] = useState<number>(0);
  const [messageHistory, setMessageHistory] = useState<string[]>([]);
  const [markDeadStage, setMarkDeadStage] = useState<boolean>(false);
  const [playerMarkedDead, setPlayerMarkedDead] = useState<boolean[]>(Array(gridSize*gridSize).fill(false));
  const [opponentMarkedDead, setOpponentMarkedDead] = useState<boolean[]>(Array(gridSize*gridSize).fill(false));
  const [confirmDeadButtonActive, setConfirmDeadButtonActive] = useState<boolean>(false);
  const [opponentConfirmedDead, setOpponentConfirmedDead] = useState<boolean>(false);
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
    const newWebsocket = new WebSocket("ws://localhost:8999");
    newWebsocket.onerror = err => console.error(err);
    newWebsocket.onopen = () => {
      setWebsocket(newWebsocket);
      newWebsocket.send(JSON.stringify({
        "type": "join",
        "gameID" : gameID
      }));
    }

    newWebsocket.onmessage = (event: any) => {
      console.log(event.data);
      let msg = JSON.parse(event.data);
      if (msg.type === "setPlayer") {
        console.log(msg.player);
        let player = msg.player;
        setPlayerType(prevPlayer => player);
      } 
    }
  }, [gameID]);

  useEffect(() => {
    if (websocket) {
      websocket.onmessage = (event: any) => {
        console.log(event.data);
        let msg = JSON.parse(event.data);
        if (msg.type === "move") {
          let nextBoard = new Go.Board(msg.board.split("").map(Number));
          let position = msg.position;
          setMoveHistory(prevMoveHistory => [...prevMoveHistory.slice(), position]);
          setHistory(prevHistory => [...prevHistory.slice(), nextBoard]);
          setBlackScore(prevBlackScore => msg.blackScore);
          setWhiteScore(prevWhiteScore => msg.whiteScore);
          setCurrentMove(prevMove => prevMove + 1);
        }
        else if (msg.type === "pass") {
          setMoveHistory(prevMoveHistory => [...prevMoveHistory.slice(), -1]);
          setHistory(prevHistory => [...prevHistory.slice(), prevHistory[prevHistory.length-1]]);
          setCurrentMove(prevMove => prevMove + 1);
        }
        else if (msg.type === "markDeadStage") {
          setMarkDeadStage(true);
        }
        else if (msg.type === "markGroupDead") {
          console.log("marking:", msg.group, msg.player, playerType);
          if (msg.player === playerType) { 
            setPlayerMarkedDead(prevPlayerMarkedDead => {
              let nextPlayerMarkedDead = prevPlayerMarkedDead.slice();
              msg.group.forEach(position => {nextPlayerMarkedDead[position] = msg.mark});
              return nextPlayerMarkedDead;
            });
          }
          else {
              setOpponentMarkedDead(prevOpponentMarkedDead => {
                let nextOpponentMarkedDead = prevOpponentMarkedDead.slice();
                msg.group.forEach(position => {nextOpponentMarkedDead[position] = msg.mark});
                return nextOpponentMarkedDead;
              });
              setConfirmDeadButtonActive(true);
          }
        }
        else if (msg.type === "confirmDead") {
          if (msg.player !== playerType) {
            setOpponentConfirmedDead(true);
          }
          else {
            setConfirmDeadButtonActive(false);
          }
        }
        else if (msg.type === "end") {
          console.log(`Game over\nBlack:\t${msg.blackScore}\nWhite:\t${msg.whiteScore}`);
        }
        else if (msg.type === "message") {
          setMessageHistory(prevHistory => [...prevHistory.slice(), msg.message]);
        }
      };
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
    websocket.send(JSON.stringify({
      gameID: gameID,
      type: "move",
      board: currentBoard.board,
      move: move
    }));
  }

  function handlePass() {
    websocket.send(JSON.stringify({
      gameID: gameID,
      type: "pass"
    }))
  }

  function handleMarkDead(position: number) {
    websocket.send(JSON.stringify({
      gameID: gameID,
      type: "deadGroup",
      player: playerType, // TODO: don't let client identify themselves
      group: currentBoard.getGroup(position)
    }));
  }

  function handleConfirmDead() {
    websocket.send(JSON.stringify({
      gameID: gameID,
      type: "confirmDead",
      player: playerType
    }))
  }

  function jumpTo(nextMove: number) {
    setCurrentMove(nextMove);
  }

  function handleChat(message: string) {
    websocket.send(JSON.stringify({
      gameID: gameID,
      type: "message",
      message: message
    }));
  }

  const moves = moveHistory.map((move, idx) => {
    let description;
    if (idx == 0) {
      description = "Start";
    }
    else if (move >= 0) {
      description = (Math.floor(move / gridSize) + 1) + ", " + ((move % gridSize) + 1);
    }
    else {
      description = "Pass";
    }
    return (
      <li key={idx}>
        <button onClick={() => jumpTo(idx)}>{description}</button>
      </li>
    );
  });

  return (
    <div className={styles.game}>
      <div className={styles.gameBoard}>
        <div className={styles.boardAndTimers}>
          <Board xIsNext={xIsNext} markDeadStage={markDeadStage} board={currentBoard} playerMarkedDead={playerMarkedDead} opponentMarkedDead={opponentMarkedDead} onPlay={handlePlay} onMarkDead={handleMarkDead} gridSize={gridSize} />
          <div className={styles.timers}>
            <OpponentTimer score={opponentScore} />
            { opponentConfirmedDead ? <div>Opponent has confirmed dead stones.</div> : null }
            <div></div>
            <button className={styles.confirmDeadButton} onClick={handleConfirmDead}>Confirm dead groups</button>
            <button className={styles.passButton} onClick={handlePass}>Pass</button>
            <PlayerTimer score={playerScore} />
          </div>
        </div>
      </div>
      <div className={styles.utilities}>
        <div className={styles.history}>
          <ol>{moves}</ol>
        </div>
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
