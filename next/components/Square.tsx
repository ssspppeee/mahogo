import styles from 'styles/Page.module.css';
import * as Go from "@/lib/Go";
import { GameStage } from "@/lib/Utils";

export default function Square({ 
  value, 
  latestMove,
  gameStage,
  playerMarkedDead, 
  opponentMarkedDead, 
  territory,
  onSquareClick 
}: {
  value: Go.Cell, 
  latestMove: boolean,
  gameStage: GameStage,
  playerMarkedDead: boolean, 
  opponentMarkedDead: boolean, 
  territory: Go.Cell,
  onSquareClick: () => void
}) {
  const imgfn = value === Go.Cell.Black ? 'black_piece.svg' : (value === Go.Cell.White ? 'white_piece.svg' : '');
  return (
    <button className={styles.square} onClick={onSquareClick}>
      { (imgfn === '') ? null : (<img className={(gameStage === GameStage.End && playerMarkedDead && opponentMarkedDead) ? styles.deadPiece : styles.piece} src={"/" + imgfn} />) }
      { latestMove ? (<div className={value === Go.Cell.Black ? styles.latestMoveMarkerBlack : styles.latestMoveMarkerWhite}></div>) : null }
      { (gameStage === GameStage.MarkDead && playerMarkedDead) ? (<div className={styles.playerMarkedDead}></div>) : null }
      { (gameStage === GameStage.MarkDead && opponentMarkedDead) ? (<div className={styles.opponentMarkedDead}></div>) : null }
      { (territory === Go.Cell.Empty) ? null : (<div className={territory === Go.Cell.Black ? styles.blackTerritory : styles.whiteTerritory}></div>) }
    </button>
  );
}
