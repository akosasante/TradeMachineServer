// Simplified types for client consumption without server dependencies

// Auth login sendResetEmail types
export interface SendResetEmailInput {
    email: string;
}

export interface SendResetEmailOutput {
    status: string;
    jobId: string;
    userId: string;
}

// Common user type (simplified to avoid Prisma dependencies)
export interface PublicUser {
    id: string;
    email: string;
    role: string;
    status: string;
    lastLoggedIn: Date | null;
}

// Router structure for type safety (will be replaced with actual AppRouter type once generated)
export interface AppRouter {
    auth: {
        login: {
            sendResetEmail: {
                input: SendResetEmailInput;
                output: SendResetEmailOutput;
            };
        };
    };
}
