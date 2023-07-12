import styles from 'styles/Page.module.css';

export default function OpponentTimer({score}: {score: number}) {
  return (
    <div className={`${styles.opponentTimer} ${styles.timer}`}>
      <div className={`${styles.score} ${styles.opponentScore}`}><span>Points: {score}</span></div>
      <div className={styles.time}>--:--</div>
    </div>
  );
}