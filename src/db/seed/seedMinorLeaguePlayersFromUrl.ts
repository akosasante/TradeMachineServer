import initializeDb from "../../bootstrap/db";
import PlayerDAO from "../../DAO/PlayerDAO";
import { doUpdate } from "../../jobs/mlbMinorsScheduledUpdate";

// tslint:disable:no-console

async function run() {
    await initializeDb(false);
    const playerDAO = new PlayerDAO();
    return await doUpdate(playerDAO);
}

run()
    .then(inserted => { console.log(inserted.length); process.exit(0); })
    .catch(err => { console.error(err); process.exit(99); });
