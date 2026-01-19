import { Connection } from "typeorm";
import { v4 as uuid } from "uuid";
import Trade, { TradeStatus } from "../../models/trade";
import TradeParticipant, { TradeParticipantType } from "../../models/tradeParticipant";
import TradeItem, { TradeItemType } from "../../models/tradeItem";
import Team from "../../models/team";
import logger from "../../bootstrap/logger";
import initializeDb from "../../bootstrap/db";

async function main() {
    console.log("=== TypeORM PrimaryGeneratedColumn Test ===");

    const connection: Connection = await initializeDb(true);
    const tradeRepo = connection.getRepository(Trade);
    const teamRepo = connection.getRepository(Team);

    // Get some existing teams or create test teams
    let teams = await teamRepo.find({ take: 2 });
    if (teams.length < 2) {
        console.log("Creating test teams...");

        // Create test teams
        const team1 = new Team({
            name: "Test Team 1",
            espnId: 999,
            status: 1,
        });
        const team2 = new Team({
            name: "Test Team 2",
            espnId: 998,
            status: 1,
        });

        const savedTeam1 = await teamRepo.save(team1);
        const savedTeam2 = await teamRepo.save(team2);
        teams = [savedTeam1, savedTeam2];

        console.log(
            "Created test teams:",
            teams.map(t => ({ id: t.id, name: t.name }))
        );
    }

    console.log(
        "Found teams:",
        teams.map(t => ({ id: t.id, name: t.name }))
    );

    // Create test payload similar to production
    const testTradePayload = {
        status: TradeStatus.REQUESTED,
        tradeParticipants: [
            {
                participantType: TradeParticipantType.CREATOR,
                team: teams[0],
            },
            {
                participantType: TradeParticipantType.RECIPIENT,
                team: teams[1],
            },
        ],
        tradeItems: [
            {
                tradeItemId: "f131e42e-1814-4cfe-985b-104d13404416",
                tradeItemType: TradeItemType.PLAYER,
                sender: teams[0],
                recipient: teams[1],
            },
        ],
    };

    console.log("\n=== Test 1: Raw save (should fail like production) ===");
    try {
        const trade1 = new Trade(testTradePayload as Partial<Trade>);
        console.log("Trade before save:", {
            id: trade1.id,
            hasTradeParticipants: !!trade1.tradeParticipants,
            participantIds: trade1.tradeParticipants?.map(tp => ({ id: tp.id, type: tp.participantType })),
            hasTradeItems: !!trade1.tradeItems,
            itemIds: trade1.tradeItems?.map(ti => ({ id: ti.id, type: ti.tradeItemType })),
        });

        const saved1 = await tradeRepo.save(trade1);
        console.log("✅ Raw save succeeded:", { id: saved1.id });
    } catch (error) {
        console.log("❌ Raw save failed:", (error as any).message);
    }

    console.log("\n=== Test 2: Manual UUID assignment (your approach) ===");
    try {
        const tradePayload2 = JSON.parse(JSON.stringify(testTradePayload)); // deep copy

        // Your approach: manually set UUIDs
        if (!tradePayload2.id) {
            tradePayload2.id = uuid();
        }

        for (const item of tradePayload2.tradeItems || []) {
            if (!item.id) {
                item.id = uuid();
            }
        }

        for (const participant of tradePayload2.tradeParticipants || []) {
            if (!participant.id) {
                participant.id = uuid();
            }
        }

        // Force a new ID even if one exists
        const finalPayload2 = { ...tradePayload2, id: uuid() };

        console.log("Trade with manual UUIDs:", {
            id: finalPayload2.id,
            participantIds: finalPayload2.tradeParticipants?.map((tp: any) => ({
                id: tp.id,
                type: tp.participantType,
            })),
            itemIds: finalPayload2.tradeItems?.map((ti: any) => ({ id: ti.id, type: ti.tradeItemType })),
        });

        const saved2 = await tradeRepo.save(finalPayload2);
        console.log("✅ Manual UUID save succeeded:", { id: saved2.id });

        // Clean up
        await tradeRepo.delete(saved2.id!);
    } catch (error) {
        console.log("❌ Manual UUID save failed:", (error as any).message);
    }

    console.log("\n=== Test 3: Cleaned object (Claude's approach) ===");
    try {
        const tradePayload3 = JSON.parse(JSON.stringify(testTradePayload)); // deep copy

        // Claude's approach: remove id fields and use constructors
        const { id, ...tradeObjWithoutId } = tradePayload3;

        const cleanedTradeObj = {
            ...tradeObjWithoutId,
            tradeParticipants: tradeObjWithoutId.tradeParticipants?.map((tp: any) => {
                const { id: tpId, ...tpWithoutId } = tp;
                return new TradeParticipant(tpWithoutId);
            }),
            tradeItems: tradeObjWithoutId.tradeItems?.map((ti: any) => {
                const { id: tiId, ...tiWithoutId } = ti;
                return new TradeItem(tiWithoutId);
            }),
        };

        console.log("Cleaned trade object:", {
            hasId: "id" in cleanedTradeObj,
            participantTypes: cleanedTradeObj.tradeParticipants?.map((tp: any) => ({
                constructor: tp.constructor.name,
                hasId: "id" in tp,
                id: tp.id,
            })),
            itemTypes: cleanedTradeObj.tradeItems?.map((ti: any) => ({
                constructor: ti.constructor.name,
                hasId: "id" in ti,
                id: ti.id,
            })),
        });

        const saved3 = await tradeRepo.save(cleanedTradeObj);
        console.log("✅ Cleaned object save succeeded:", { id: saved3.id });

        // Clean up
        await tradeRepo.delete(saved3.id!);
    } catch (error) {
        console.log("❌ Cleaned object save failed:", (error as any).message);
    }

    console.log("\n=== Test 4: Empty Trade (baseline test) ===");
    try {
        const emptyTrade = new Trade({
            status: TradeStatus.DRAFT,
        });

        console.log("Empty trade before save:", { id: emptyTrade.id });

        const saved4 = await tradeRepo.save(emptyTrade);
        console.log("✅ Empty trade save succeeded:", { id: saved4.id });

        // Clean up
        await tradeRepo.delete(saved4.id!);
    } catch (error) {
        console.log("❌ Empty trade save failed:", (error as any).message);
    }

    console.log("\n=== Decorator Investigation ===");

    // Check if decorators are properly applied
    const tradeMetadata = connection.getMetadata(Trade);
    const primaryColumn = tradeMetadata.primaryColumns[0];

    console.log("Trade metadata:", {
        tableName: tradeMetadata.tableName,
        primaryColumn: {
            propertyName: primaryColumn.propertyName,
            type: primaryColumn.type,
            isGenerated: primaryColumn.isGenerated,
            generationStrategy: primaryColumn.generationStrategy,
        },
    });

    const participantMetadata = connection.getMetadata(TradeParticipant);
    const participantPrimaryColumn = participantMetadata.primaryColumns[0];

    console.log("TradeParticipant metadata:", {
        tableName: participantMetadata.tableName,
        primaryColumn: {
            propertyName: participantPrimaryColumn.propertyName,
            type: participantPrimaryColumn.type,
            isGenerated: participantPrimaryColumn.isGenerated,
            generationStrategy: participantPrimaryColumn.generationStrategy,
        },
    });

    const itemMetadata = connection.getMetadata(TradeItem);
    const itemPrimaryColumn = itemMetadata.primaryColumns[0];

    console.log("TradeItem metadata:", {
        tableName: itemMetadata.tableName,
        primaryColumn: {
            propertyName: itemPrimaryColumn.propertyName,
            type: itemPrimaryColumn.type,
            isGenerated: itemPrimaryColumn.isGenerated,
            generationStrategy: itemPrimaryColumn.generationStrategy,
        },
    });

    console.log("\n=== Test Complete ===");

    // Close the connection
    await connection.close();
}

main().catch(e => {
    console.error("Test failed:", e);
    process.exit(1);
});
