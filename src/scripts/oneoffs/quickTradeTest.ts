import { Connection } from "typeorm";
import { v4 as uuid } from "uuid";
import Trade, { TradeStatus } from "../../models/trade";
import TradeParticipant, { TradeParticipantType } from "../../models/tradeParticipant";
import TradeItem, { TradeItemType } from "../../models/tradeItem";
import Team from "../../models/team";
import initializeDb from "../../bootstrap/db";

async function main() {
    console.log("=== Quick Trade Creation Test ===");

    const connection: Connection = await initializeDb(false); // Disable query logging
    const tradeRepo = connection.getRepository(Trade);
    const teamRepo = connection.getRepository(Team);

    try {
        // Get existing teams or create minimal test teams
        let teams = await teamRepo.find({ take: 2 });
        if (teams.length < 2) {
            console.log("Creating test teams...");
            const team1 = new Team({ name: "Test Team A", espnId: 901, status: 1 });
            const team2 = new Team({ name: "Test Team B", espnId: 902, status: 1 });

            const savedTeam1 = await teamRepo.save(team1);
            const savedTeam2 = await teamRepo.save(team2);
            teams = [savedTeam1, savedTeam2];
            console.log(
                "Created teams with IDs:",
                teams.map(t => t.id)
            );
        } else {
            console.log(
                "Using existing teams:",
                teams.map(t => ({ id: t.id, name: t.name }))
            );
        }

        console.log("Creating trade without explicit IDs...");

        const testTrade = new Trade({
            status: TradeStatus.DRAFT,
            tradeParticipants: [
                new TradeParticipant({
                    participantType: TradeParticipantType.CREATOR,
                    team: teams[0],
                }),
                new TradeParticipant({
                    participantType: TradeParticipantType.RECIPIENT,
                    team: teams[1],
                }),
            ],
            tradeItems: [
                new TradeItem({
                    tradeItemId: uuid(), // Use proper UUID for tradeItemId
                    tradeItemType: TradeItemType.PLAYER,
                    sender: teams[0],
                    recipient: teams[1],
                }),
            ],
        });

        console.log("Trade before save - ID:", testTrade.id || "undefined");
        console.log(
            "Participants before save - IDs:",
            testTrade.tradeParticipants?.map(tp => tp.id || "undefined")
        );
        console.log(
            "Items before save - IDs:",
            testTrade.tradeItems?.map(ti => ti.id || "undefined")
        );

        const savedTrade = await tradeRepo.save(testTrade);

        console.log("✅ SUCCESS! Trade created with ID:", savedTrade.id);
        console.log(
            "Trade UUID format valid:",
            /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(savedTrade.id!)
        );

        // Clean up
        await tradeRepo.delete(savedTrade.id!);
        console.log("Trade cleaned up successfully");
    } catch (error) {
        console.log("❌ FAILED:", (error as any)?.message);
        console.log("Full error:", error);
    }

    await connection.close();
    console.log("=== Test Complete ===");
    process.exit(0);
}

main().catch(e => {
    console.error("Test error:", e);
    process.exit(1);
});
