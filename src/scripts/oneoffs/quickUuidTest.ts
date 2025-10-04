import { Connection } from "typeorm";
import User, { Role, UserStatus } from "../../models/user";
import initializeDb from "../../bootstrap/db";

async function main() {
    console.log("=== Quick UUID Test ===");

    const connection: Connection = await initializeDb(false); // Disable query logging
    const userRepo = connection.getRepository(User);

    try {
        console.log("Creating user without explicit ID...");

        const testUser = new User({
            email: "quicktest@example.com",
            displayName: "Quick Test User",
            role: Role.ADMIN,
            status: UserStatus.ACTIVE,
        });

        console.log("User before save - ID:", testUser.id || "undefined");

        const savedUser = await userRepo.insert([testUser]);
        console.log("Insert result:", savedUser);

        const fetchedUser = await userRepo.findOne({ where: { email: "quicktest@example.com" } });

        if (fetchedUser) {
            console.log("✅ SUCCESS! User created with ID:", fetchedUser);
            console.log(
                "UUID format looks valid:",
                /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(fetchedUser.id!)
            );

            // Clean up
            await userRepo.delete(fetchedUser.id!);
            console.log("User cleaned up successfully");
            process.exit(0);
        }
    } catch (error) {
        console.log("❌ FAILED:", (error as any).message);
    }

    await connection.close();
    console.log("=== Test Complete ===");
    process.exit(0);
}

main().catch(console.error);
