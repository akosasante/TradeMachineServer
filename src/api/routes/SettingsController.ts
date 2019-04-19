import { Body, Delete, Get, JsonController, Param, Post, Put, QueryParam } from "routing-controllers";
import { Authorized } from "routing-controllers/decorator/Authorized";
import logger from "../../bootstrap/logger";
import SettingsDAO, { ScheduleGetAllOptions } from "../../DAO/SettingsDAO";
import ScheduledDowntime from "../../models/scheduledDowntime";
import { Role } from "../../models/user";

@JsonController("/settings")
export default class SettingsController {
    private dao: SettingsDAO;

    constructor(DAO?: SettingsDAO) {
        this.dao = DAO || new SettingsDAO();
    }

    @Get("/downtime")
    public async getAllScheduledDowntime(@QueryParam("option") option?: "future"|"previous"):
        Promise<ScheduledDowntime[]> {
        logger.debug("get all scheduled downtimes endpoint" + `${option ? " -- " + option : ""}`);
        let getAllOption: ScheduleGetAllOptions|undefined;
        if (option) {
            getAllOption = option === "future"
                ? ScheduleGetAllOptions.FUTURE
                : option === "previous"
                    ? ScheduleGetAllOptions.PREVIOUS : undefined;
        }
        return await this.dao.getAllScheduledDowntimes(getAllOption);
    }

    @Get("/downtime/current")
    public async getCurrentlyScheduledDowntime(): Promise<ScheduledDowntime> {
        logger.debug("get currently scheduled downtime endpoint");
        return await this.dao.getCurrentlyScheduledDowntime();
    }

    @Get("/downtime/:id([0-9]+)")
    public async getOneScheduledDowntime(@Param("id") id: number): Promise<ScheduledDowntime> {
        logger.debug("get one downtime endpoint");
        return await this.dao.getScheduledDowntimeById(id);
    }

    @Authorized(Role.ADMIN)
    @Post("/downtime")
    public async createScheduledDowntime(@Body() downtimeObj: Partial<ScheduledDowntime>): Promise<ScheduledDowntime> {
        logger.debug("create downtime endpoint");
        return await this.dao.createScheduledDowntime(downtimeObj);
    }

    @Authorized(Role.ADMIN)
    @Put("/downtime/:id")
    public async updateScheduledDowntime(@Param("id") id: number, @Body() downtimeObj: Partial<ScheduledDowntime>):
        Promise<ScheduledDowntime> {
        logger.debug("update downtime endpoint");
        return await this.dao.updateScheduledDowntime(id, downtimeObj);
    }

    @Authorized(Role.ADMIN)
    @Delete("/downtime/:id")
    public async deleteScheduledDowntime(@Param("id") id: number) {
        logger.debug("delete shcedule endpoint");
        const result = await this.dao.deleteScheduledDowntime(id);
        return { deleteResult: !!result.raw[1], id };
    }
}
