import Head from 'next/head';
import { router } from 'next/router';

export default function Home() {
  return (
    <>
      <Head>
        <title>mahogo</title>
      </Head>
      
      <main>
        <h1>
          <button
            type="button"
            onClick={async () => {
              let response = await fetch("/api/createGame");
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
        </h1>
      </main>
    </>
  );
}

      


