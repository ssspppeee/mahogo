import styles from 'styles/Page.module.css';

export default function History({moves, gridSize}: {moves: any[], gridSize: number}) {
  const history = moves
    .filter((value, idx) => idx % 2 == 0)
    .map((value, idx) => {
      let blackIdx = 2*idx + 1;
      let blackMove = value === -1 ? "Pass" : (Math.floor(value / gridSize) + 1) + "-" + ((value % gridSize) + 1);
      let whiteIdx = 2*idx + 2;
      let whiteMove;
      if (whiteIdx <= moves.length) {
        let whiteValue = moves[whiteIdx-1];
        whiteMove = whiteValue === -1 ? "Pass" : (Math.floor(whiteValue / gridSize) + 1) + "-" + ((whiteValue % gridSize) + 1);
      }
      return (
        <div className={styles.historyRow} key={idx}>
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