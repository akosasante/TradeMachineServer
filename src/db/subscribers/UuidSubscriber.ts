import { EntitySubscriberInterface, EventSubscriber, InsertEvent } from "typeorm";
import { v4 as uuid } from "uuid";
import { BaseModel } from "../../models/base";
import { inspect } from "util";
import logger from "../../bootstrap/logger";

@EventSubscriber()
export class UuidSubscriber implements EntitySubscriberInterface<BaseModel> {
    /**
     * Called before entity insertion.
     * Ensures all BaseModel entities have UUIDs since TypeORM auto-generation is not working.
     */
    beforeInsert(event: InsertEvent<BaseModel>): void {
        logger.debug(`UuidSubscriber beforeInsert called for entity: ${inspect(event.entity, { depth: 1 })}`);
        if (event.entity instanceof BaseModel && !event.entity.id) {
            event.entity.id = uuid();
        }
    }
}
