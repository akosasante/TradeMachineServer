import { Connection } from "typeorm";
import User, { Role, UserStatus } from "../../models/user";
import initializeDb from "../../bootstrap/db";

async function main() {
    console.log("=== BaseModel @BeforeInsert Hook Test ===");

    const connection: Connection = await initializeDb(false); // Disable query logging
    const userRepo = connection.getRepository(User);

    try {
        console.log("Creating user without explicit ID using BeforeInsert hook...");

        const testUser = new User({
            email: "hooktest@example.com",
            displayName: "Hook Test User",
            role: Role.ADMIN,
            status: UserStatus.ACTIVE,
        });

        console.log("User before save - ID:", testUser.id || "undefined");

        const savedUser = await userRepo.save(testUser);

        console.log("✅ SUCCESS! User created with ID:", savedUser.id);
        console.log(
            "UUID format valid:",
            /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(savedUser.id!)
        );

        // Clean up
        await userRepo.delete(savedUser.id!);
        console.log("User cleaned up successfully");
    } catch (error) {
        console.log("❌ FAILED:", (error as any).message);
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
