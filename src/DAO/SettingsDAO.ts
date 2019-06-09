import { NotFoundError } from "routing-controllers";
import { Connection, DeleteResult, FindManyOptions, getConnection, LessThan, MoreThan, Repository } from "typeorm";
import GeneralSettings from "../models/generalSettings";
import ScheduledDowntime from "../models/scheduledDowntime";

export enum ScheduleGetAllOptions {
    PREVIOUS,
    FUTURE,
}

export default class SettingsDAO {
    public connection: Connection;
    private scheduleDb: Repository<ScheduledDowntime>;
    private settingsDb: Repository<GeneralSettings>;

    constructor() {
        this.connection = getConnection(process.env.NODE_ENV);
        this.scheduleDb = this.connection.getRepository("ScheduledDowntime");
        this.settingsDb = this.connection.getRepository("GeneralSettings");
    }

    public async getAllScheduledDowntimes(option?: ScheduleGetAllOptions): Promise<ScheduledDowntime[]> {
        // @ts-ignore
        const queryOpts: FindManyOptions<ScheduledDowntime> = { order: { startTime: "ASC" } };
        if (Object.values(ScheduleGetAllOptions).includes(option)) {
            queryOpts.where = option === ScheduleGetAllOptions.FUTURE
                ? { startTime: MoreThan(new Date()) }
                : { endTime: LessThan(new Date()) };
        }
        const dbSchedules = await this.scheduleDb.find(queryOpts);
        return dbSchedules.map(sch => new ScheduledDowntime(sch));
    }

    public async getScheduledDowntimeById(id: number): Promise<ScheduledDowntime> {
        if (!id) {
            throw new NotFoundError("Id is required");
        }
        const dbSchedule = await this.scheduleDb.findOneOrFail(id);
        return new ScheduledDowntime(dbSchedule);
    }

    public async getCurrentlyScheduledDowntime(): Promise<ScheduledDowntime> {
        const queryOpts: FindManyOptions<ScheduledDowntime> = {
            where: { startTime: LessThan(new Date()), endTime: MoreThan(new Date()) } ,
        };
        const dbSchedule = await this.scheduleDb.findOneOrFail(queryOpts);
        return new ScheduledDowntime(dbSchedule);
    }

    public async createScheduledDowntime(downtimeObj: Partial<ScheduledDowntime>): Promise<ScheduledDowntime> {
        const dbSchedule = await this.scheduleDb.save(downtimeObj);
        return new ScheduledDowntime(dbSchedule);
    }

    public async updateScheduledDowntime(id: number, downtimeObj: Partial<ScheduledDowntime>):
        Promise<ScheduledDowntime> {
        await this.scheduleDb.update( { id }, downtimeObj);
        return await this.getScheduledDowntimeById(id);
    }

    public async deleteScheduledDowntime(id: number): Promise<DeleteResult> {
        if (!id) {
            throw new NotFoundError("Id is required");
        }
        await this.scheduleDb.findOneOrFail(id);
        return await this.scheduleDb.delete(id);
    }

    public async getAllGeneralSettings(): Promise<GeneralSettings[]> {
        const options: FindManyOptions = {order: {dateCreated: "DESC"}};
        const dbSettings = await this.settingsDb.find(options);
        return dbSettings.map(settings => new GeneralSettings(settings));
    }

    public async getSettingsById(id: number): Promise<GeneralSettings> {
        if (!id) {
            throw new NotFoundError("Id is required");
        }
        const dbSettings = await this.settingsDb.findOneOrFail(id);
        return new GeneralSettings(dbSettings);
    }

    public async getMostRecentSettings(): Promise<GeneralSettings|undefined> {
        const options: FindManyOptions = {order: {dateCreated: "DESC"}, take: 1};
        const dbSettings = await this.settingsDb.find(options);
        return dbSettings.length ? new GeneralSettings(dbSettings[0]) : undefined;
    }

    public async insertNewSettingsLine(settingsObj: Partial<GeneralSettings>): Promise<GeneralSettings> {
        const mostRecentSettings = (await this.getMostRecentSettings()) || {};
        const newSettingsObj = Object.assign(mostRecentSettings, settingsObj, {id: undefined});
        const dbSettings = await this.settingsDb.save(newSettingsObj);
        return new GeneralSettings(dbSettings);
    }
}
