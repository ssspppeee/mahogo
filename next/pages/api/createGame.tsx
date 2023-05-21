
import * as crypto from 'crypto';
export default async function handler(req, res) {
    // TODO: check for collisions
    // const id = new Uint32Array(16);
    // const gameID = crypto.randomBytes(8).toString('hex');
    // res.status(200).json({'gameID': gameID});
    let response = await fetch("http://localhost:8999/api/createGame");
    let json = await response.json();
    res.status(200).json({'gameID': json.gameID});
}