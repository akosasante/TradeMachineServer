import { config as dotenvConfig } from "dotenv";
import { resolve as resolvePath } from "path";
dotenvConfig({path: resolvePath(__dirname, "../../../.env")});
import initializeDb from "../../bootstrap/db";
import { registerUser } from "./helpers/authHelper";
import { createAdminUser, createGenericUser, createInactiveUser, saveUser } from "./helpers/userCreator";
import User from "../../models/user";

// tslint:disable:no-console

async function run() {
    const args = process.argv.slice(2);
    await initializeDb(process.env.DB_LOGS === "true");
    let user = getUserObj(args);
    if (user) {
        [user] = await saveUser(user);
        return await registerUser(user);
    }
}

function getUserObj(args: any[]) {
    switch ((args[0] || "").toLowerCase()) {
        case "custom":
            console.log("Creating a custom user");
            if (args[1]) {
                console.log(args[1]);
                const userObj = JSON.parse(args[1]);
                console.log(`Passing in the object: ${userObj}`);
                return new User(userObj);
            } else {
                console.log("No custom object passed in. Skipping seed.");
                return undefined;
            }
        case "inactive":
            console.log("Creating an inactive user");
            return createInactiveUser();
        case "admin":
            console.log("Creating an admin user");
            return createAdminUser();
        default:
            console.log("Creating a generic user");
            return createGenericUser();
    }
}

run()
    .then(user => { console.log(user); process.exit(999); })
    .catch(err => { console.error(err); process.exit(999); });
