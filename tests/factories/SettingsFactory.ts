import { TradeDeadlineStatus } from "../../src/models/generalSettings";
import ScheduledDowntime from "../../src/models/scheduledDowntime";

export class SettingsFactory {
    public static DEFAULT_START = new Date("January 1 2019 1:00");
    public static DEFAULT_END = new Date("February 1 2019 5:00");

    public static getTradeDailyDeadline(startTime = SettingsFactory.DEFAULT_START,
                                        endTime = SettingsFactory.DEFAULT_END, rest = {}) {
        return {status: TradeDeadlineStatus.ON, startTime, endTime, ...rest};
    }

    public static getTradeDailyDeadlineOff(startTime = SettingsFactory.DEFAULT_START,
                                           endTime = SettingsFactory.DEFAULT_END, rest = {}) {
        return SettingsFactory.getTradeDailyDeadline(startTime, endTime, {status: TradeDeadlineStatus.OFF, ...rest});
    }

    public static getTradeDowntimeObj(startTime = SettingsFactory.DEFAULT_START,
                                      endTime = SettingsFactory.DEFAULT_END, rest = {}) {
        return {startTime, endTime, ...rest};
    }

    public static getTradeDowntime(startTime = SettingsFactory.DEFAULT_START,
                                   endTime = SettingsFactory.DEFAULT_END, rest = {}) {
        return new ScheduledDowntime(SettingsFactory.getTradeDowntimeObj(startTime, endTime, rest));
    }
}
