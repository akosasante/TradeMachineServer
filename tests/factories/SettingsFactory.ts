import Settings, { DowntimeSettings, TradeWindowSettings } from "../../src/models/settings";
import User from "../../src/models/user";
import { UserFactory } from "./UserFactory";
import { v4 as uuid } from "uuid";

export class SettingsFactory {
    public static DEFAULT_WINDOW_START = "18:00:00";
    public static DEFAULT_WINDOW_END = "08:00:00";
    public static DEFAULT_DOWNTIME_START = new Date("January 1 2019 5:00");
    public static DEFAULT_DOWNTIME_END = new Date("February 1 2019 5:00");
    public static DEFAULT_DOWNTIME_REASON = "off-season";

    public static getSettingsObject(modifiedBy: User = UserFactory.getUser(),
                                    tradeWindow?: TradeWindowSettings,
                                    downtimeWindow?: DowntimeSettings) {
        return { id: uuid(),
            modifiedBy,
            tradeWindowStart: tradeWindow?.tradeWindowStart,
            tradeWindowEnd: tradeWindow?.tradeWindowEnd,
            downtimeStartDate: downtimeWindow?.downtimeStartDate,
            downtimeEndDate: downtimeWindow?.downtimeEndDate,
            downtimeReason: downtimeWindow?.downtimeReason };
    }

    public static getSettings(modifiedBy: User = UserFactory.getUser(),
                              tradeWindow?: TradeWindowSettings,
                              downtimeWindow?: DowntimeSettings): Settings {
        return new Settings(SettingsFactory.getSettingsObject(modifiedBy, tradeWindow, downtimeWindow));
    }
}
