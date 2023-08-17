import { useState } from 'react';
import styles from 'styles/Page.module.css';
import * as Go from "@/lib/Go";
import { GameStage, Player } from "@/lib/Utils";

export default function Square({ 
  value, 
  player,
  blackIsNext,
  latestMove,
  gameStage,
  playerMarkedDead, 
  opponentMarkedDead, 
  territory,
  onSquareClick 
}: {
  value: Go.Cell, 
  player: Player,
  blackIsNext: boolean,
  latestMove: boolean,
  gameStage: GameStage,
  playerMarkedDead: boolean, 
  opponentMarkedDead: boolean, 
  territory: Go.Cell,
  onSquareClick: () => void
}) {
  const [hover, setHover] = useState<boolean>(false);
  const imgfn = value === Go.Cell.Black ? '/black_piece.svg' : (value === Go.Cell.White ? '/white_piece.svg' : null);
  const showPiece = imgfn !== null;
  const showPieceDead = gameStage === GameStage.End && playerMarkedDead && opponentMarkedDead;
  const thisPlayersTurn = (blackIsNext && player === Player.Black) || (!blackIsNext && player == Player.White)
  const showHoverPiece = gameStage === GameStage.Play && thisPlayersTurn && hover && value === Go.Cell.Empty;
  return (
    <button className={styles.square} onClick={onSquareClick} onMouseOver={() => setHover(true)} onMouseOut={() => setHover(false)}>
      { showPiece ? (<img className={ showPieceDead ? styles.deadPiece : styles.piece} src={imgfn} />) : null}
      { showHoverPiece ? (<img className={styles.deadPiece} src={"/" + (player === Player.Black ? 'black_piece.svg' : 'white_piece.svg')} />) : null }
      { latestMove ? (<div className={value === Go.Cell.Black ? styles.latestMoveMarkerBlack : styles.latestMoveMarkerWhite}></div>) : null }
      { (gameStage === GameStage.MarkDead && playerMarkedDead) ? (<div className={styles.playerMarkedDead}></div>) : null }
      { (gameStage === GameStage.MarkDead && opponentMarkedDead) ? (<div className={styles.opponentMarkedDead}></div>) : null }
      { (territory === Go.Cell.Empty) ? null : (<div className={territory === Go.Cell.Black ? styles.blackTerritory : styles.whiteTerritory}></div>) }
    </button>
  );
}
