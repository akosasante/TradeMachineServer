import logger from "../bootstrap/logger";

const cleanupCallbacks: (() => Promise<void>)[] = [];

export const registerCleanupCallback = (callback: () => Promise<void>): void => {
    cleanupCallbacks.push(callback);
};

export const setupSignalHandlers = () => {
    const handleExit = async (reason: string) => {
        logger.info(`Application exiting due to ${reason}`);
        for (const callback of cleanupCallbacks) {
            try {
                logger.info(`Running cleanup callback..., ${callback.name}`);
                await callback();
            } catch (error) {
                logger.error(`Error during cleanup: ${error}`);
            }
        }
        // eslint-disable-next-line no-process-exit
        process.exit(0);
    };

    process.on("SIGINT", () => void handleExit("SIGINT"));
    process.on("SIGTERM", () => void handleExit("SIGTERM"));
};
