import styles from 'styles/Page.module.css';

export default function PlayerTimer({score}: {score: number}) {
  return (
    <div className={`${styles.playerTimer} ${styles.timer}`}>
      <div className={styles.time}>--:--</div>
      <div className={`${styles.score} ${styles.playerScore}`}><span>Points: {score}</span></div>
    </div>
  );
 }