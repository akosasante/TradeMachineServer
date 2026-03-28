/**
 * Single authoritative module-augmentation for express-session.
 * Import this file anywhere that needs access to the extended session fields.
 * TypeScript's declaration merging means this only needs to be declared once.
 */
declare module "express-session" {
    interface SessionData {
        user: string | undefined;
        userEmail: string | undefined;
        userName: string | undefined;
    }
}

export {};
