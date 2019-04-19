import { NotFoundError } from "routing-controllers";
import { Connection, DeleteResult, FindManyOptions, getConnection, LessThan, MoreThan, Repository } from "typeorm";
import ScheduledDowntime from "../models/scheduledDowntime";

export enum ScheduleGetAllOptions {
    PREVIOUS,
    FUTURE,
}

export default class SettingsDAO {
    public connection: Connection;
    private scheduleDb: Repository<ScheduledDowntime>;

    constructor() {
        this.connection = getConnection(process.env.NODE_ENV);
        this.scheduleDb = this.connection.getRepository("ScheduledDowntime");
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
}
