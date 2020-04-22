import { config as dotenvConfig } from "dotenv";
import { resolve as resolvePath } from "path";
dotenvConfig({path: resolvePath(__dirname, "../../../.env")});
import initializeDb from "../../bootstrap/db";
import { createGenericTeam, createInactiveTeam, saveOwners, saveTeam } from "./helpers/teamCreator";
import Team from "../../models/team";
import UserDAO from "../../DAO/UserDAO";

// tslint:disable:no-console

async function run() {
    const args = process.argv.slice(2);
    await initializeDb(process.env.DB_LOGS === "true");
    let team = getTeamObj(args);
    if (!team) {
        return;
    }
    [team] = await saveTeam(team);
    switch ((args[0] || "").toLowerCase()) {
        case "owned":
            console.log("Setting custom ownership");
            if (args[1]) {
                console.log(`Owner: ${args[1]}`);
                const userDao = new UserDAO();
                const user = await userDao.getUserById(args[1]);
                if (user) {
                    return await saveOwners(team, [user]);
                } else {
                    console.log("No user with that ID available in DB. Skipping setting owner");
                    return undefined;
                }
            } else {
                console.log("No owner ID passed in. Skipping seed.");
                return undefined;
            }
        case "custom":
            if (args[1] && JSON.parse(args[1]).owners) {
                console.log("Custom team included owners");
                return await saveOwners(team, JSON.parse(args[1]).owners);
            } else {
                console.log("Custom team did not include owners. Setting random ownership");
                return await saveOwners(team);
            }
        default:
            console.log("Setting random ownership");
            return await saveOwners(team);
    }
}

function getTeamObj(args: any[]) {
    switch ((args[0] || "").toLowerCase()) {
        case "custom":
            console.log("Creating a custom team");
            if (args[1]) {
                const teamObj = JSON.parse(args[1]);
                console.log(`Passing in the object: ${teamObj}`);
                return new Team(teamObj);
            } else {
                console.log("No custom object passed in. Skipping seed.");
                return undefined;
            }

        case "inactive":
            console.log("Creating an inactive team");
            return createInactiveTeam();
        default:
            console.log("Creating generic team");
            return createGenericTeam();
    }
}

run()
    .then(user => { console.log(user); process.exit(999); })
    .catch(err => { console.error(err); process.exit(999); });
