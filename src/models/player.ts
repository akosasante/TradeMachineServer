import { Column, Entity, Index, ManyToOne, Unique } from "typeorm";
import { BaseModel } from "./base";
import Team from "./team";
import { EspnMajorLeaguePlayer } from "../espn/espnApi";
import {
    ESPN_ELIGIBLE_POSITION_MAPPING,
    ESPN_NON_POSITIONAL_NON_VALID_SLOTS,
    ESPN_POSITION_MAPPING,
    espnMajorLeagueTeamFromId
} from "../espn/espnConstants";

/* eslint-disable @typescript-eslint/naming-convention */
export enum PlayerLeagueType {
    MAJOR = 1,
    MINOR,
}
/* eslint-enable @typescript-eslint/naming-convention */

@Entity()
@Unique(["name", "playerDataId"])
@Index(["league"])
@Index(["leagueTeam"])
@Index(["leagueTeam", "league"])
export default class Player extends BaseModel {
    @Column()
    @Index()
    public name!: string;

    @Column({ type: "enum", enum: PlayerLeagueType, nullable: true })
    public league?: PlayerLeagueType;

    @Column({ nullable: true })
    public mlbTeam?: string;

    @Column({ nullable: true })
    public playerDataId?: number;

    @Column({ nullable: true, type: "jsonb" })
    public meta?: any;

    @ManyToOne(_type => Team, team => team.players, { onDelete: "SET NULL" })
    public leagueTeam?: Team;

    constructor(props: Partial<Player> & Required<Pick<Player, "name">>) {
        super();
        Object.assign(this, props);
    }

    public static convertEspnMajorLeaguerToPlayer(espnPlayer: EspnMajorLeaguePlayer): Player {
        const position = espnPlayer.player?.defaultPositionId
            ? ESPN_POSITION_MAPPING[espnPlayer.player?.defaultPositionId]
            : undefined;
        return new Player({
            league: PlayerLeagueType.MAJOR,
            name: espnPlayer.player?.fullName || `ESPN Player #${espnPlayer.id || ""}`,
            mlbTeam: espnMajorLeagueTeamFromId(espnPlayer.player?.proTeamId)?.abbrev.toUpperCase(),
            playerDataId: espnPlayer.id,
            meta: { espnPlayer, position },
        });
    }

    public getEspnEligiblePositions(): string | undefined {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access
        const slots = this.meta?.espnPlayer?.player?.eligibleSlots;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (slots && slots.length) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
            return slots
                .filter((slot: number) => !ESPN_NON_POSITIONAL_NON_VALID_SLOTS.includes(slot))
                .map((slot: number) => ESPN_ELIGIBLE_POSITION_MAPPING[slot])
                .join(", ");
        }
    }
}
