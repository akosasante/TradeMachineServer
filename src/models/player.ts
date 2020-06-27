import { Column, Entity, Index, ManyToOne, Unique } from "typeorm";
import { BaseModel } from "./base";
import Team from "./team";
import { EspnMajorLeaguePlayer } from "../espn/espnApi";
import {
    EspnEligiblePositionMapping,
    espnMajorLeagueTeamFromId,
    EspnNonPositionalNonValidSlots,
    EspnPositionMapping
} from "../espn/espnConstants";

export enum PlayerLeagueType {
    MAJOR,
    MINOR,
}

@Entity()
@Unique(["name", "playerDataId"])
export default class Player extends BaseModel {
    @Column()
    @Index()
    public name!: string;

    @Column({type: "enum", enum: PlayerLeagueType, nullable: true})
    public league?: PlayerLeagueType;

    @Column({nullable: true})
    public mlbTeam?: string;

    @Column({nullable: true})
    public playerDataId?: number;

    @Column({nullable: true, type: "jsonb"})
    public meta?: any;

    @ManyToOne(_type => Team, team => team.players, {onDelete: "SET NULL"})
    public leagueTeam?: Team;

    constructor(props: Partial<Player> & Required<Pick<Player, "name">>) {
        super();
        Object.assign(this, props);
    }

    public static convertEspnMajorLeaguerToPlayer(espnPlayer: EspnMajorLeaguePlayer): Player {
        const position = espnPlayer.player?.defaultPositionId ? EspnPositionMapping[espnPlayer.player?.defaultPositionId] : undefined;
        return new Player({
            league: PlayerLeagueType.MAJOR,
            name: espnPlayer.player?.fullName || `ESPN Player #${espnPlayer.id || ""}`,
            mlbTeam: espnMajorLeagueTeamFromId(espnPlayer.player?.proTeamId)?.abbrev.toUpperCase(),
            playerDataId: espnPlayer.id,
            meta: { espnPlayer, position },
        });
    }

    public getEspnEligiblePositions(): string|undefined {
        const slots = this.meta?.espnPlayer?.player?.eligibleSlots;
        if (slots && slots.length) {
            return slots
                .filter((slot: number) => !EspnNonPositionalNonValidSlots.includes(slot))
                .map((slot: number) => EspnEligiblePositionMapping[slot])
                .join(", ");
        }
    }
}
