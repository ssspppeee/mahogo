import styles from 'styles/Page.module.css';
import { GameStage } from "@/lib/Utils";

export default function PassConfirmButton({gameStage, handlePass, handleConfirmDead}: {gameStage: GameStage, handlePass: any, handleConfirmDead: any}) {
  if (gameStage === GameStage.Play) {
    return <button className={styles.passButton} onClick={handlePass}>Pass</button>
  } else {
    return <button className={styles.passButton} onClick={handleConfirmDead}>Confirm dead groups</button>
  }
}