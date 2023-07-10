import Head from 'next/head';
import { useRouter } from 'next/router';
import { useState, useEffect, useImperativeHandle } from 'react';
import styles from 'styles/Home.module.css';

const BACKEND_HOST = process.env.BACKEND_HOST || "localhost";
const BACKEND_PORT = process.env.BACKEND_PORT || 8999;

function GameOptions() {
  let router = useRouter();
  let [boardSize, setBoardSize] = useState<number>(19);
  let [player, setPlayer] = useState<string>("random");
  let [handicap, setHandicap] = useState<number>(0);
  let [komi, setKomi] = useState<number>(6.5);
  return (
    <div className={styles.gameOptions}>
      <h2>Play Go with a friend</h2>
      <div className={styles.labelSelect}>
        <label htmlFor="boardSizeSelect">Board size</label>
        <select id="boardSizeSelect" defaultValue="19" className={styles.select} onChange={e => setBoardSize(Number(e.target.value))}>
          <option value="9">9x9</option>
          <option value="13">13x13</option>
          <option value="19">19x19</option>
        </select>
      </div>
      <div className={styles.labelSelect}>
        <label htmlFor="playerSelect">Colour</label>
        <select id="playerSelect" defaultValue="random" className={styles.select} onChange={e => setPlayer(e.target.value)}>
          <option value="random">Random</option>
          <option value="black">Black</option>
          <option value="white">White</option>
        </select>
      </div>
      <div className={styles.labelSelect}>
        <label htmlFor="handicapSelect">Handicap</label>
        <select name="handicapSelect" defaultValue="0" className={styles.select} onChange={e => setHandicap(Number(e.target.value))}>
          <option value="0">None</option>
          <option value="1">1</option>
          <option value="2">2</option>
          <option value="3">3</option>
          <option value="4">4</option>
          <option value="5">5</option>
          <option value="6">6</option>
          <option value="7">7</option>
          <option value="8">8</option>
          <option value="9">9</option>
        </select>
      </div>
      <div className={styles.labelSelect}>
        <label htmlFor="komiSelect">Komi</label>
        <select name="komi" defaultValue="6.5" className={styles.select} onChange={e => setKomi(Number(e.target.value))}>
          <option value="0.5">0.5</option>
          <option value="1.5">1.5</option>
          <option value="2.5">2.5</option>
          <option value="3.5">3.5</option>
          <option value="4.5">4.5</option>
          <option value="5.5">5.5</option>
          <option value="6.5">6.5</option>
          <option value="7.5">7.5</option>
          <option value="8.5">8.5</option>
          <option value="9.5">9.5</option>
        </select>
      </div>
      <button
        className={styles.createGameButton}
        type="button"
        onClick={async () => {
          let response = await fetch(`http://${BACKEND_HOST}:${BACKEND_PORT}/api/createGame`, {
            method: "POST",
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              "boardSize": boardSize,
              "player": player,
              "handicap": handicap,
              "komi": komi
            }),
          });
          let json = await response.json()
          let gameID = json.gameID;
          router.push({
            pathname: '/game/[gameID]',
            query: { gameID: gameID },
          })
        }}
      >
        Create game
      </button>
    </div>
  )
}

export default function Home() {
  let router = useRouter();
  return (
    <>
      <Head>
        <title>mahogo</title>
      </Head>
      
      <main>
        <div className={styles.gameOptionsContainer}>
          <GameOptions />
        </div>
      </main>
    </>
  );
}

      


