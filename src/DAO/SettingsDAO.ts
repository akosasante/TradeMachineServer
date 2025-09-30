import { FindManyOptions, FindOneOptions, getConnection, InsertResult, Repository } from "typeorm";
import Settings from "../models/settings";
import { BadRequestError } from "routing-controllers";
import logger from "../bootstrap/logger";
import { inspect } from "util";
import { QueryDeepPartialEntity } from "typeorm/query-builder/QueryPartialEntity";

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
        const options: FindManyOptions<Settings> = { order: { dateCreated: "DESC" }, skip: 0, take: 1 };
        const results = await this.settingsDb.find(options);
        return results?.[0];
    }

    public async getSettingsById(id: string): Promise<Settings> {
        return await this.settingsDb.findOneOrFail({ where: { id } } as FindOneOptions<Settings>);
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

        const settingsEntity = this.settingsDb.create(newLine);
        return await this.settingsDb.save(settingsEntity);
    }
}
