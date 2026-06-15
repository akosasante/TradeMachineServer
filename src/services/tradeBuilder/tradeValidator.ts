import { TradeParticipantType } from "@prisma/client";
import TradeDAO, { PrismaTrade } from "../../DAO/v2/TradeDAO";

export interface TeamSummary {
    teamId: string;
    teamName: string;
    sendsCount: number;
    receivesCount: number;
}

export interface TradeSummary {
    trade: PrismaTrade;
    teams: TeamSummary[]; // one entry per participant team
}

export type ValidationErrorCode = "MISSING_CREATOR" | "MULTIPLE_CREATORS" | "NO_RECIPIENTS" | "NO_TRADE_ITEMS";

export type ValidationWarningCode = "TEAM_RECEIVES_NOTHING";

export interface ValidationError {
    code: ValidationErrorCode;
    message: string;
}

export interface ValidationWarning {
    code: ValidationWarningCode;
    message: string;
    teamId?: string;
    teamName?: string;
}

export interface TradeValidationResult {
    summary: TradeSummary;
    errors: ValidationError[];
    warnings: ValidationWarning[];
    canSend: boolean; // errors.length === 0
}

/**
 * Hydrates the trade and computes per-team send/receive counts.
 * This is the single source of truth for item counts — both validateTrade
 * and the /review endpoint should call this rather than re-computing counts.
 */
export async function buildTradeSummary(tradeId: string, tradeDao: TradeDAO): Promise<TradeSummary> {
    const trade = await tradeDao.getTradeById(tradeId);

    const teams: TeamSummary[] = trade.tradeParticipants
        .filter((p): p is typeof p & { teamId: string } => p.teamId !== null)
        .map(p => {
            const teamId = p.teamId;
            const sendsCount = trade.tradeItems.filter(item => item.senderId === teamId).length;
            const receivesCount = trade.tradeItems.filter(item => item.recipientId === teamId).length;

            return {
                teamId,
                teamName: p.team?.name ?? teamId,
                sendsCount,
                receivesCount,
            };
        });

    return { trade, teams };
}

/**
 * Validates a trade's structural integrity.
 * Returns errors (blocking) and warnings (advisory) derived from the trade summary.
 */
export async function validateTrade(tradeId: string, tradeDao: TradeDAO): Promise<TradeValidationResult> {
    const summary = await buildTradeSummary(tradeId, tradeDao);
    const { trade, teams } = summary;

    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Structural checks
    const creators = trade.tradeParticipants.filter(p => p.participantType === TradeParticipantType.CREATOR);
    const recipients = trade.tradeParticipants.filter(p => p.participantType === TradeParticipantType.RECIPIENT);

    if (creators.length === 0) {
        errors.push({ code: "MISSING_CREATOR", message: "Trade must have exactly one creator." });
    }

    if (creators.length > 1) {
        errors.push({ code: "MULTIPLE_CREATORS", message: "Trade cannot have more than one creator." });
    }

    if (recipients.length === 0) {
        errors.push({ code: "NO_RECIPIENTS", message: "Trade must have at least one recipient." });
    }

    if (trade.tradeItems.length === 0) {
        errors.push({ code: "NO_TRADE_ITEMS", message: "Trade must include at least one item." });
    }

    // Advisory warnings
    for (const team of teams) {
        if (team.receivesCount === 0) {
            warnings.push({
                code: "TEAM_RECEIVES_NOTHING",
                message: `Team "${team.teamName}" receives nothing in this trade.`,
                teamId: team.teamId,
                teamName: team.teamName,
            });
        }
    }

    return {
        summary,
        errors,
        warnings,
        canSend: errors.length === 0,
    };
}
