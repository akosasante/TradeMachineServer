import { faker } from "@faker-js/faker";
import Team, { TeamStatus } from "../../../models/team";
import UserDAO from "../../../DAO/UserDAO";
import TeamDAO from "../../../DAO/TeamDAO";
import User from "../../../models/user";
import { sample } from "lodash";
import { randomUUID } from "crypto";

let dao: TeamDAO | null;
let allUsers: User[] | null;

async function init() {
    if (!dao || !allUsers) {
        dao = new TeamDAO();
        const userDao = new UserDAO();
        allUsers = await userDao.getAllUsers();
    }
    return dao;
}

export function createGenericTeam() {
    const name = `Team ${faker.random.word()}`;
    const status = TeamStatus.ACTIVE;
    return new Team({ id: randomUUID(), name, status });
}

export function createInactiveTeam() {
    const team = createGenericTeam();
    team.status = TeamStatus.DISABLED;
    return team;
}

export async function saveTeam(team: Team) {
    const teamDAO = await init();
    return await teamDAO.createTeams([team]);
}

export async function saveOwners(team: Team, owners?: User[]) {
    const teamDAO = await init();
    if (!owners) {
        owners = [sample(allUsers)!];
    }
    return await teamDAO.updateTeamOwners(team.id!, owners, []);
}
