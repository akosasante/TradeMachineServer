import { Body, Get, JsonController, Param, Post } from "routing-controllers";
import { Authorized } from "routing-controllers/decorator/Authorized";
import logger from "../../bootstrap/logger";
import SettingsDAO from "../../DAO/SettingsDAO";
import Settings from "../../models/settings";
import { Role } from "../../models/user";
import { UUIDPattern } from "../helpers/ApiHelpers";

@JsonController("/settings")
export default class SettingsController {
    private dao: SettingsDAO;

    constructor(DAO?: SettingsDAO) {
        this.dao = DAO || new SettingsDAO();
    }

    @Authorized(Role.ADMIN)
    @Get("/")
    public async getAllSettings(): Promise<Settings[]> {
        logger.debug("get all settings endpoint");
        const settings = await this.dao.getAllSettings();
        logger.debug(`got ${settings.length} settings lines`);
        return settings;
    }

    @Authorized(Role.ADMIN)
    @Get("/current")
    public async getCurrentSettings(): Promise<Settings | undefined> {
        logger.debug("get most recent settings endpoint");
        const settings = await this.dao.getMostRecentSettings();
        logger.debug(`got settings: ${settings}`);
        return settings;
    }

    @Authorized(Role.ADMIN)
    @Get(UUIDPattern)
    public async getOneSettingsLine(@Param("id") id: string): Promise<Settings> {
        logger.debug("get one settings line by id endpoint");
        const settings = await this.dao.getSettingsById(id);
        logger.debug(`got settings: ${settings}`);
        return settings;
    }

    @Authorized(Role.ADMIN)
    @Post("/")
    public async appendNewSettingsLine(@Body() settingsObj: Partial<Settings>): Promise<Settings> {
        logger.debug("create new settings entry");
        const settings = await this.dao.insertNewSettings(settingsObj);
        logger.debug(`created new settings entry: ${settings}`);
        return settings;
    }
}
