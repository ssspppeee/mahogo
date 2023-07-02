
import * as crypto from 'crypto';
export default async function handler(req, res) {
    let response = await fetch("http://backend:8999/api/createGame");
    let json = await response.json();
    res.status(200).json({'gameID': json.gameID});
}