import { Connection } from "typeorm";
import Trade, { TradeStatus } from "../../models/trade";
import TradeParticipant, { TradeParticipantType } from "../../models/tradeParticipant";
import TradeItem, { TradeItemType } from "../../models/tradeItem";
import Team from "../../models/team";
import User, { Role, UserStatus } from "../../models/user";
import initializeDb from "../../bootstrap/db";

async function main() {
    console.log("=== UUID Subscriber Test ===");

    const connection: Connection = await initializeDb(true);
    const teamRepo = connection.getRepository(Team);
    const tradeRepo = connection.getRepository(Trade);
    const userRepo = connection.getRepository(User);

    console.log("\n=== Test 1: Create a simple User (BaseModel test) ===");
    try {
        const testUser = new User({
            email: "test@subscriber.com",
            displayName: "Test User",
            role: Role.ADMIN,
            status: UserStatus.ACTIVE,
        });

        console.log("User before save:", { id: testUser.id, email: testUser.email });

        const savedUser = await userRepo.save(testUser);
        console.log("✅ User created successfully:", { id: savedUser.id, email: savedUser.email });

        // Clean up
        await userRepo.delete(savedUser.id!);
        console.log("User cleaned up");
    } catch (error) {
        console.log("❌ User creation failed:", (error as any).message);
    }

    console.log("\n=== Test 2: Create a Trade with nested entities ===");
    try {
        // Get or create test teams
        let teams = await teamRepo.find({ take: 2 });
        if (teams.length < 2) {
            const team1 = new Team({ name: "Test Team 1", espnId: 999, status: 1 });
            const team2 = new Team({ name: "Test Team 2", espnId: 998, status: 1 });

            const savedTeam1 = await teamRepo.save(team1);
            const savedTeam2 = await teamRepo.save(team2);
            teams = [savedTeam1, savedTeam2];
            console.log("Created test teams");
        }

        const testTradePayload = {
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
                    tradeItemId: "f131e42e-1814-4cfe-985b-104d13404416",
                    tradeItemType: TradeItemType.PLAYER,
                    sender: teams[0],
                    recipient: teams[1],
                }),
            ],
        };

        console.log("Trade payload IDs before save:", {
            trade: (testTradePayload as any).id || "undefined",
            participants: testTradePayload.tradeParticipants?.map(tp => tp.id || "undefined"),
            items: testTradePayload.tradeItems?.map(ti => ti.id || "undefined"),
        });

        const savedTrade = await tradeRepo.save(testTradePayload);
        console.log("✅ Trade created successfully:", { id: savedTrade.id });

        // Clean up
        await tradeRepo.delete(savedTrade.id!);
        console.log("Trade cleaned up");
    } catch (error) {
        console.log("❌ Trade creation failed:", (error as any).message);
        console.log("Error details:", error);
    }

    console.log("\n=== Test Complete ===");
    await connection.close();
}

main().catch(e => {
    console.error("Test failed:", e);
    process.exit(1);
});
