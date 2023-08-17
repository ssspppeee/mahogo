import styles from 'styles/Page.module.css';
import * as Go from "@/lib/Go";
import { GameStage, Player } from "@/lib/Utils";
import Square from "./Square";

export default function Board({ 
  player,
  blackIsNext, 
  gameStage,
  board, 
  latestMove,
  playerMarkedDead, 
  opponentMarkedDead, 
  territory,
  onPlay, 
  onMarkDead,
  gridSize 
}: {
  player: Player,
  blackIsNext: boolean, 
  gameStage: GameStage,
  board: Go.Board,
  latestMove: number,
  playerMarkedDead: boolean[],
  opponentMarkedDead: boolean[],
  territory: Go.Cell[],
  onPlay: (move: Go.Move) => void, 
  onMarkDead: (position: number) => void,
  gridSize: number
}) {
  let boardStyle, boardContainerStyle;
  if (gridSize === 9) {
    boardStyle = styles.board9x9;
    boardContainerStyle = styles.boardContainer9x9;
  }
  else if (gridSize === 13) {
    boardStyle = styles.board13x13;
    boardContainerStyle = styles.boardContainer13x13;
  }
  else if (gridSize === 19) {
    boardStyle = styles.board19x19;
    boardContainerStyle = styles.boardContainer19x19;
  }

  function handleClick(position: number) {
    if (gameStage === GameStage.MarkDead && board.board[position] != Go.Cell.Empty) {
      onMarkDead(position);
    }
    else if (gameStage === GameStage.Play) {
      const move = new Go.Move(position, blackIsNext ? Go.Cell.Black : Go.Cell.White);
      const nextBoard = board.updateBoard(move);
      if (nextBoard !== null) {
        onPlay(move);
      }
    }
  }

  const squares = [...Array(gridSize*gridSize).keys()].map((i) => {
    return <Square key={i} value={board.board[i]} player={player} blackIsNext={blackIsNext} gameStage={gameStage} latestMove={latestMove === i} playerMarkedDead={playerMarkedDead[i]} opponentMarkedDead={opponentMarkedDead[i]} territory={territory[i]} onSquareClick={() => handleClick(i)} />
  });

  return (
    <div className={boardContainerStyle}>
      <div className={boardStyle}>
        { squares }
      </div>
    </div>
  );
}
