import { FindManyOptions, FindOneOptions, getConnection, InsertResult, Repository } from "typeorm";
import Settings from "../models/settings";
import { BadRequestError } from "routing-controllers";
import logger from "../bootstrap/logger";
import { inspect } from "util";

export default class SettingsDAO {
    private settingsDb: Repository<Settings>;

    constructor(repo?: Repository<Settings>) {
        this.settingsDb = repo || getConnection(process.env.ORM_CONFIG).getRepository("Settings");
    }

    public async getAllSettings(): Promise<Settings[]> {
        const options: FindManyOptions = { order: { dateCreated: "DESC" } };
        return await this.settingsDb.find(options);
    }

    public async getMostRecentSettings(): Promise<Settings | undefined> {
        const options: FindOneOptions = { order: { dateCreated: "DESC" } };
        return await this.settingsDb.findOne(options);
    }

    public async getSettingsById(id: string): Promise<Settings> {
        return await this.settingsDb.findOneOrFail(id);
    }

    public async insertNewSettings(settings: Partial<Settings>): Promise<Settings> {
        // TODO: Consider implementing validation of settings
        //  eg. if one downtime field is entered, they all must be.
        if (!settings.modifiedBy) {
            throw new BadRequestError("Modifying user must be provided");
        }
        logger.debug(`new settings: ${inspect(settings)}`);
        const mostRecentSettings = await this.getMostRecentSettings();
        logger.debug(`old settings: ${inspect(mostRecentSettings)}`);
        const newLine = {
            ...(mostRecentSettings || {}),
            ...settings,
            id: settings.id || undefined,
            dateModified: undefined,
            dateCreated: undefined,
        };

        const result: InsertResult = await this.settingsDb.insert(newLine);

        return await this.settingsDb.findOneOrFail(result.identifiers[0]);
    }
}
