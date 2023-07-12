import styles from 'styles/Page.module.css';
import { GameStage } from "@/lib/Utils";

export default function PassConfirmButton({gameStage, active, handlePass, handleConfirmDead}: {gameStage: GameStage, active: boolean, handlePass: any, handleConfirmDead: any}) {
  if (gameStage === GameStage.Play) {
    return <button className={styles.passButton} onClick={handlePass}>Pass</button>
  } else {
    return <button className={styles.passButton} onClick={handleConfirmDead} disabled={!active}>Confirm dead groups</button>
  }
}