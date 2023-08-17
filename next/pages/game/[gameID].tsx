import Head from 'next/head';
import { useRouter } from 'next/router';
import Sidebar from 'components/Sidebar';
import Game from 'components/Game';
import styles from 'styles/Page.module.css';
import React from 'react';

export default function GamePage() {
  const router = useRouter();
  console.log("Query:", router.query);
  let gameID = router.query.gameID;
  if (Array.isArray(gameID)) { // router.query.gameID can be string[], apparently
    return null;
  }
  return (
    <React.StrictMode>
      <Head>
        <title>Play Go online</title>
      </Head>
      <div className={styles.page}>
        <Sidebar />
        { router.isReady ? <Game gameID={gameID} key={gameID}/> : null }
      </div>
    </React.StrictMode>
  );
}
