import { Column, Entity, Index, ManyToOne } from "typeorm";
import { BaseModel } from "./base";
import Team from "./team";
import { EspnMajorLeaguePlayer } from "../espn/espnApi";
import { espnMajorLeagueTeamFromId, EspnPositionMapping } from "../espn/espnConstants";

export enum LeagueLevel {
    MAJOR = "Majors",
    HIGH = "High Minors",
    LOW = "Low Minors",
}

@Entity()
export default class Player extends BaseModel {
    @Column()
    @Index()
    public name!: string;

    @Column({type: "enum", enum: LeagueLevel, nullable: true})
    public league?: LeagueLevel;

    @Column({nullable: true})
    public mlbTeam?: string;

    @Column({nullable: true, type: "jsonb"})
    public meta?: any;

    @ManyToOne(type => Team, team => team.players, {onDelete: "SET NULL"})
    public leagueTeam?: Team;

    constructor(props: Partial<Player> & Required<Pick<Player, "name">>) {
        super();
        Object.assign(this, props);
    }

    public static convertEspnMajorLeaguerToPlayer(espnPlayer: EspnMajorLeaguePlayer): Player {
        const position = espnPlayer.player?.defaultPositionId ? EspnPositionMapping[espnPlayer.player?.defaultPositionId] : undefined;
        return new Player({
            league: LeagueLevel.MAJOR,
            name: espnPlayer.player?.fullName || `ESPN Player #${espnPlayer.id}`,
            mlbTeam: espnMajorLeagueTeamFromId(espnPlayer.player?.proTeamId)?.abbrev.toUpperCase(),
            meta: { espnPlayer, position },
        });
    }
}
