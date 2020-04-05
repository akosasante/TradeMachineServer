import { FindManyOptions, FindOneOptions, getConnection, InsertResult, Repository } from "typeorm";
import Settings from "../models/settings";

export default class SettingsDAO {
    private settingsDb: Repository<Settings>;

    constructor(repo?: Repository<Settings>) {
        this.settingsDb = repo || getConnection(process.env.NODE_ENV).getRepository("Settings");
    }

    public async getAllSettings(): Promise<Settings[]> {
        const options: FindManyOptions = {order: {dateCreated: "DESC"}};
        return await this.settingsDb.find(options);
    }

    public async getMostRecentSettings(): Promise<Settings | undefined> {
        const options: FindOneOptions = {order: {dateCreated: "DESC"}};
        return await this.settingsDb.findOne(options);
    }

    public async getSettingsById(id: string): Promise<Settings> {
        return await this.settingsDb.findOneOrFail(id);
    }

    public async insertNewSettings(settings: Partial<Settings>): Promise<Settings | undefined> {
        const mostRecentSettings = await this.getMostRecentSettings();
        const newLine = {...(mostRecentSettings || {}),
            ...settings, id: undefined, dateModified: undefined, dateCreated: undefined,
        };
        const result: InsertResult =  await this.settingsDb.insert(newLine);
        const retrievedLine =  await this.settingsDb.find(result.identifiers[0]);
        return retrievedLine && retrievedLine.length ? retrievedLine[0] : undefined;
    }
}
