import { PrismaClient, Prisma } from '@prisma/client';

export default function initializeDb(log = false): PrismaClient {
    const options: Prisma.PrismaClientOptions = {}
    if (log) {
        options.log = ['query', 'info', 'warn', 'error'];
        options.errorFormat = 'pretty';
    }
    return new PrismaClient(options)
}
