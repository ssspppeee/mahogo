import { useRouter } from 'next/router';
import Sidebar from 'components/Sidebar';
import Game from 'components/Game';
import styles from 'styles/Page.module.css';

export default function GamePage() {
  const router = useRouter();
  console.log(router.query);
  let gameID = router.query.gameID;
  if (Array.isArray(gameID)) { // router.query.gameID can be string[], apparently
    return null;
  }
  return (
    <div className={styles.page}>
      <Sidebar />
      { gameID !== null ? <Game gameID={gameID} key={gameID}/> : null }
    </div>
  );
}
