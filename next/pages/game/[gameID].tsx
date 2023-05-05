import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import styles from 'styles/Page.module.css';
import * as Go from "@/lib/Go";

function Square({ value, onSquareClick }: {value: Go.Cell, onSquareClick: () => void}) {
  const imgfn = value === Go.Cell.Black ? 'black_piece.png' : (value === Go.Cell.White ? 'white_piece.png' : '');
  if (imgfn === '') {
    return (
      <button className={styles.square} onClick={onSquareClick} />
    );
  }
  else {
    return (
      <button className={styles.square} onClick={onSquareClick}>
        <img src={"/" + imgfn} />
      </button>
    );
  }
}

function Board({ xIsNext, board, onPlay, gridSize }: {xIsNext: boolean, board: Go.Board, onPlay: (move: Go.Move) => void, gridSize: number}) {

  function handleClick(position: number) {
    // if (gameOver()) {
    //   return;
    // }
    const move = new Go.Move(position, xIsNext ? Go.Cell.Black : Go.Cell.White)
    const nextBoard = board.updateBoard(move);
    if (nextBoard !== null) {
      onPlay(move);
    }
  }

  // const winner = calculateWinner(squares);
  /*
  const winner = false;
  let status;
  if (winner) {
    status = "Winner: " + winner;
  }
  else {
    status = "Next player: " + (xIsNext ? "X" : "O");
  }
  */

  const squares = [...Array(gridSize*gridSize).keys()].map((i) => {
    return <Square key={i} value={board.board[i]} onSquareClick={() => handleClick(i)} />
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
    if (event.key == "Enter") {
      console.log(message);
      sendMessage(message);
      setMessage('');
    }
  }

  const messages = messageHistory.map((message, index) => {
    return (
      <li className="chatMessage" key={index}>
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
        minLength="1"
        maxLength="140" 
        placeholder="Send a message" 
      /> 
    </div>
  );
}

function PlayerTimer() {
  return (
    <div className={`${styles.playerTimer} ${styles.placeholder}`}>
      <span>player timer</span>
    </div>
  );
}

function OpponentTimer() {
  return (
    <div className={`${styles.opponentTimer} ${styles.placeholder}`}>
      <span>opponent timer</span>
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
  const [messageHistory, setMessageHistory] = useState<string[]>([]);
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
      if (msg.type === "move") {
        let nextBoard = new Go.Board(msg.board.split("").map(Number));
        let position = msg.position;
        // const nextMoveHistory = [...moveHistory.slice(), position];
        // const nextHistory = [...history.slice(0, currentMove + 1), nextBoard];
        setMoveHistory(prevMoveHistory => [...prevMoveHistory.slice(), position]);
        setHistory(prevHistory => [...prevHistory.slice(), nextBoard]);
        setCurrentMove(prevMove => prevMove + 1);
      }
      else if (msg.type === "message") {
        // const nextMessageHistory = [...messageHistory.slice(), msg.message];
        setMessageHistory(prevHistory => [...prevHistory.slice(), msg.message]);
      }
    };
  }, [gameID]);

  function handlePlay(move: Go.Move) {
    // const nextHistory = [...history.slice(0, currentMove + 1), nextBoard];
    // setHistory(nextHistory);
    // setCurrentMove(nextHistory.length - 1);
    websocket.send(JSON.stringify({
      gameID: gameID,
      type: "move",
      board: currentBoard.board,
      move: move
    }));
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
    if (move >= 0) {
      description = (Math.floor(move / gridSize) + 1) + ", " + ((move % gridSize) + 1);
    }
    else {
      description = "Start";
    }
    return (
      <li key={move}>
        <button onClick={() => jumpTo(idx)}>{description}</button>
      </li>
    );
  });

  return (
    <div className={styles.game}>
      <div className={styles.gameBoard}>
        <div className={styles.boardAndTimers}>
          <Board xIsNext={xIsNext} board={currentBoard} onPlay={handlePlay} gridSize={gridSize} />
          <div className={styles.timers}>
            <OpponentTimer />
            <div></div>
            <PlayerTimer />
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
  return (
    <div className={styles.page}>
      <Sidebar />
      <Game gameID={gameID} />
    </div>
  );
}
/*
class GameState {
  board: (string | null)[];
  blackScore: number;
  whiteScore: number;
  blackNext: boolean;

  constructor(board: (string | null)[], blackScore: number, whiteScore: number, blackNext: boolean) {
    this.board = board;
    this.blackScore = blackScore;
    this.whiteScore = whiteScore;
    this.blackNext = blackNext;
  }
}

function getGroup(board: (string | null)[], position: number): number[] {
  let group = new Set<number>();
  let stack: number[] = [position];
  while (stack.length > 0)  {
    let p = stack.pop();
    group.add(p!);
    getNeighbours(board, p!)
      .filter(n => board[n] === board[p!])
      .filter(n => !group.has(n))
      .forEach(n => { stack.push(n); });
  }
  return Array.from(group);
}

function getNeighbours(board: (string | null)[], position: number): number[] {
  let boardSize = Math.sqrt(board.length);
  let neighbours = [];
  if (position - boardSize >= 0 ) { // UP
    neighbours.push(position - boardSize);
  }
  if (position + boardSize < board.length) { // DOWN
    neighbours.push(position + boardSize);
  }
  if (position % boardSize > 0) { // LEFT
    neighbours.push(position - 1);
  }
  if (position % boardSize < boardSize - 1) { // RIGHT
    neighbours.push(position + 1);
  }
  return neighbours;
}

function getAdjacentEnemyGroups(board: (string | null)[], position: number): number[][] {
  return getNeighbours(board, position)
    .filter(neighbour => board[neighbour] !== null)
    .filter(neighbour => board[neighbour] !== board[position])
    .map(neighbour => getGroup(board, neighbour));
}

function countLiberties(board: (string | null)[], group: number[]): number {
  return group
    .map(position => getNeighbours(board, position))
    .flat()
    .filter((v, i, a) => a.indexOf(v) === i) // deduplicate
    .filter(position => board[position] === null)
    .length;
}

function groupSize(group: number[]): number {
  return group.length;
}

function removeGroup(board: (string | null)[], group: number[]) {
  group.forEach(position => { board[position] = null; });
}

function updateBoard(gameState: GameState, position: number): GameState | null {
  if (gameState.board[position] !== null) {
    console.log("Invalid move: piece already at position.");
    return null;
  }
  let nextBoard = gameState.board.slice();
  let nextBlackScore = gameState.blackScore;
  let nextWhiteScore = gameState.whiteScore;
  let nextBlackNext = !gameState.blackNext;

  nextBoard[position] = gameState.blackNext ? 'X' : 'O';
  let adjacentEnemyGroups = getAdjacentEnemyGroups(nextBoard, position);
  let adjacentGroupDied = false;
  console.log("Neighbours of ", position, getNeighbours(nextBoard, position));
  adjacentEnemyGroups.forEach((group) => {
    console.log("Adjacent enemy groups and liberties:", group, countLiberties(nextBoard, group));
    if (countLiberties(nextBoard, group) === 0) {
      adjacentGroupDied = true;
      if (gameState.blackNext) {
        nextBlackScore += groupSize(group);
      }
      else {
        nextWhiteScore += groupSize(group);
      }
      removeGroup(nextBoard, group);
    }
  });
  if (!adjacentGroupDied) {
    if (countLiberties(nextBoard, getGroup(nextBoard, position)) === 0) {
      console.log("Invalid move.");
      return null;
    }
  }
  return new GameState(nextBoard, nextBlackScore, nextWhiteScore, nextBlackNext);
    
}
*/
