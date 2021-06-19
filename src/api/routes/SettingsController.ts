import { Authorized, Body, Get, JsonController, Param, Post, Req } from "routing-controllers";
import logger from "../../bootstrap/logger";
import SettingsDAO from "../../DAO/SettingsDAO";
import Settings from "../../models/settings";
import { Role } from "../../models/user";
import { UUID_PATTERN } from "../helpers/ApiHelpers";
import { rollbar } from "../../bootstrap/rollbar";
import { Request } from "express";

@JsonController("/settings")
export default class SettingsController {
    private dao: SettingsDAO;

    constructor(dao?: SettingsDAO) {
        this.dao = dao || new SettingsDAO();
    }

    @Authorized(Role.ADMIN)
    @Get("/")
    public async getAllSettings(@Req() request?: Request): Promise<Settings[]> {
        rollbar.info("getAllSettings", request);
        logger.debug("get all settings endpoint");
        const settings = await this.dao.getAllSettings();
        logger.debug(`got ${settings.length} settings lines`);
        return settings;
    }

    @Authorized(Role.ADMIN)
    @Get("/current")
    public async getCurrentSettings(@Req() request?: Request): Promise<Settings | undefined> {
        rollbar.info("getCurrentSettings", request);
        logger.debug("get most recent settings endpoint");
        const settings = await this.dao.getMostRecentSettings();
        logger.debug(`got settings: ${settings}`);
        return settings;
    }

    @Authorized(Role.ADMIN)
    @Get(UUID_PATTERN)
    public async getOneSettingsLine(@Param("id") id: string, @Req() request?: Request): Promise<Settings> {
        rollbar.info("getOneSettingsLine", { settingsLineId: id }, request);
        logger.debug("get one settings line by id endpoint");
        const settings = await this.dao.getSettingsById(id);
        logger.debug(`got settings: ${settings}`);
        return settings;
    }

    @Authorized(Role.ADMIN)
    @Post("/")
    public async appendNewSettingsLine(
        @Body() settingsObj: Partial<Settings>,
        @Req() request?: Request
    ): Promise<Settings> {
        logger.debug("create new settings entry");
        rollbar.info("appendNewSettingsLine", settingsObj, request);
        const settings = await this.dao.insertNewSettings(settingsObj);
        logger.debug(`created new settings entry: ${settings}`);
        return settings;
    }
}
