import initializeDb from "../../bootstrap/db";
import { registerUser } from "./helpers/authHelper";
import { createAdminUser, saveUser } from "./helpers/userCreator";

// tslint:disable

async function run() {
    await initializeDb(process.env.DB_LOGS === "true");
    let user = await saveUser(await createAdminUser());
    user = await registerUser(user);
    return user;
}

run()
    .then(user => { console.log(user); process.exit(999); })
    .catch(err => { console.error(err); process.exit(999); })
