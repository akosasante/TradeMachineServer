import { AfterLoad, Column, Entity, Index, ManyToOne, Unique } from "typeorm";
import { BaseModel } from "./base";
import Team from "./team";

/* eslint-disable @typescript-eslint/naming-convention */
export enum LeagueLevel {
    MAJORS = 1,
    HIGH,
    LOW,
}

export const MinorLeagueLevels = [LeagueLevel.HIGH, LeagueLevel.LOW];
/* eslint-enable @typescript-eslint/naming-convention */

@Entity()
@Unique(["type", "season", "round", "originalOwner"])
@Index(["currentOwner"])
@Index(["originalOwner"])
@Index(["currentOwner", "originalOwner"])
export default class DraftPick extends BaseModel {
    @Column({ type: "numeric" })
    public round!: number;
    @Column({ type: "int", nullable: true })
    public pickNumber?: number;
    @Column({ type: "int" })
    public season!: number;
    @Column({ type: "enum", enum: LeagueLevel })
    public type!: LeagueLevel;
    @ManyToOne(_type => Team, team => team.draftPicks, { eager: true, onDelete: "SET NULL" })
    public currentOwner?: Team;
    @ManyToOne(_type => Team, team => team.originalDraftPicks, { eager: true, onDelete: "SET NULL" })
    public originalOwner?: Team;

    constructor(props: Partial<DraftPick> & Required<Pick<DraftPick, "season" | "round" | "type">>) {
        super();
        Object.assign(this, props);
    }

    static leagueLevelToString(level: LeagueLevel): string | undefined {
        switch (level) {
            case LeagueLevel.MAJORS:
                return "Majors";
            case LeagueLevel.HIGH:
                return "High Minors";
            case LeagueLevel.LOW:
                return "Low Minors";
            default:
                return;
        }
    }

    @AfterLoad()
    ensureRoundType(): void {
        this.round = Number(this.round);
    }
}
