import "jest-extended";
import TradeController from "../../../../src/api/routes/TradeController";
import TradeDAO from "../../../../src/DAO/TradeDAO";
import Trade, { TradeStatus } from "../../../../src/models/trade";
import { TradeParticipantType } from "../../../../src/models/tradeParticipant";
import { TradeFactory } from "../../../factories/TradeFactory";
import logger from "../../../../src/bootstrap/logger";
import { UserFactory } from "../../../factories/UserFactory";
import { BadRequestError, UnauthorizedError } from "routing-controllers";
import { TeamFactory } from "../../../factories/TeamFactory";
import { TradeItemType } from "../../../../src/models/tradeItem";
import { HydratedTrade } from "../../../../src/models/views/hydratedTrades";
import { mockClear, mockDeep } from "jest-mock-extended";

describe("TradeController", () => {
    const mockTradeDAO = mockDeep<TradeDAO>();

    const testTrade = TradeFactory.getTrade();
    const creator = testTrade.tradeParticipants?.find(part => part.participantType === TradeParticipantType.CREATOR);
    const recipient = testTrade.tradeParticipants?.find(
        part => part.participantType === TradeParticipantType.RECIPIENT
    );
    const tradeOwner = UserFactory.getOwnerUser();
    creator!.team.owners = [tradeOwner];
    const tradeRecipient = UserFactory.getOwnerUser();
    recipient!.team.owners = [tradeRecipient];
    const tradeController = new TradeController(mockTradeDAO as unknown as TradeDAO);

    beforeAll(() => {
        logger.debug("~~~~~~TRADE CONTROLLER TESTS BEGIN~~~~~~");
    });
    afterAll(() => {
        logger.debug("~~~~~~TRADE CONTROLLER TESTS COMPLETE~~~~~~");
    });
    afterEach(() => {
        mockClear(mockTradeDAO);
    });

    describe("getAllTrades method", () => {
        it("should return an array of trades", async () => {
            mockTradeDAO.getAllTrades.mockResolvedValueOnce([testTrade]);
            const res = await tradeController.getAllTrades();

            expect(mockTradeDAO.getAllTrades).toHaveBeenCalledTimes(1);
            expect(mockTradeDAO.getAllTrades).toHaveBeenCalledWith();
            expect(mockTradeDAO.hydrateTrade).toHaveBeenCalledTimes(0);
            expect(res).toEqual([testTrade]);
        });
        it("should hydrate each trade before returning an array of trades if query param is present", async () => {
            mockTradeDAO.returnHydratedTrades.mockResolvedValueOnce([[testTrade as HydratedTrade], 1]); // TODO: update this test properly
            const res = await tradeController.getAllTrades(true);

            expect(mockTradeDAO.returnHydratedTrades).toHaveBeenCalledTimes(1);
            expect(mockTradeDAO.returnHydratedTrades).toHaveBeenCalledWith(undefined, undefined, undefined, undefined);
            expect(mockTradeDAO.getAllTrades).toHaveBeenCalledTimes(0);
            expect(mockTradeDAO.hydrateTrade).toHaveBeenCalledTimes(0);
            expect(res).toEqual({ trades: [testTrade as HydratedTrade], total: 1 });
        });
        it("should pass in any page parameters to hydrated trade call if present", async () => {
            mockTradeDAO.returnHydratedTrades.mockResolvedValueOnce([[testTrade as HydratedTrade], 1]); // TODO: update this test properly
            const res = await tradeController.getAllTrades(true, 50, 1);

            expect(mockTradeDAO.returnHydratedTrades).toHaveBeenCalledTimes(1);
            expect(mockTradeDAO.returnHydratedTrades).toHaveBeenCalledWith(undefined, undefined, 50, 1);
            expect(res).toEqual({ trades: [testTrade as HydratedTrade], total: 1 });
        });
        it("should pass in any search parameters to the hydrated trade call if present", async () => {
            const pendingStatuses = [TradeStatus.PENDING, TradeStatus.REQUESTED];
            const team = TeamFactory.getTeam();
            mockTradeDAO.returnHydratedTrades.mockResolvedValueOnce([[testTrade as HydratedTrade], 1]); // TODO: update this test properly to use a mock hydrated trade instead of a test trade
            const res = await tradeController.getAllTrades(true, 50, 1, pendingStatuses, team.name);

            expect(mockTradeDAO.returnHydratedTrades).toHaveBeenCalledTimes(1);
            expect(mockTradeDAO.returnHydratedTrades).toHaveBeenCalledWith(pendingStatuses, team.name, 50, 1);
            expect(res).toEqual({ trades: [testTrade as HydratedTrade], total: 1 });
        });
        it("should bubble up any errors from the DAO", async () => {
            mockTradeDAO.getAllTrades.mockImplementation(() => {
                throw new Error("Generic Error");
            });
            await expect(tradeController.getAllTrades()).rejects.toThrow(Error);
        });
    });

    describe("getOneTrade method", () => {
        it("should return a trade by id", async () => {
            mockTradeDAO.getTradeById.mockResolvedValueOnce(testTrade);
            const res = await tradeController.getOneTrade(testTrade.id!);

            expect(mockTradeDAO.getTradeById).toHaveBeenCalledTimes(1);
            expect(mockTradeDAO.getTradeById).toHaveBeenCalledWith(testTrade.id);
            expect(mockTradeDAO.hydrateTrade).toHaveBeenCalledTimes(0);

            expect(res).toEqual(testTrade);
        });
        it("should hydrate the trade if the boolean is set to true", async () => {
            mockTradeDAO.getTradeById.mockResolvedValueOnce(testTrade);
            mockTradeDAO.hydrateTrade.mockResolvedValueOnce(testTrade);
            const res = await tradeController.getOneTrade(testTrade.id!, true);

            expect(mockTradeDAO.getTradeById).toHaveBeenCalledTimes(1);
            expect(mockTradeDAO.getTradeById).toHaveBeenCalledWith(testTrade.id);
            expect(mockTradeDAO.hydrateTrade).toHaveBeenCalledTimes(1);
            expect(mockTradeDAO.hydrateTrade).toHaveBeenCalledWith(testTrade);
            expect(res).toEqual(testTrade);
        });
    });

    describe("createTrade method", () => {
        it("should create a trade", async () => {
            mockTradeDAO.createTrade.mockResolvedValueOnce(testTrade);
            const res = await tradeController.createTrade(tradeOwner, testTrade.parse());

            expect(mockTradeDAO.createTrade).toHaveBeenCalledTimes(1);
            expect(mockTradeDAO.createTrade).toHaveBeenCalledWith(testTrade.parse());
            expect(res).toEqual(testTrade);
        });
        it("should throw a BadRequestError if a non-admin tries to create a trade with an invalid status", async () => {
            const invalidTrade = new Trade({ ...testTrade, status: TradeStatus.ACCEPTED });
            await expect(tradeController.createTrade(tradeOwner, invalidTrade.parse())).rejects.toThrow(
                BadRequestError
            );
        });
    });

    describe("updateTrade method", () => {
        beforeEach(() => {
            mockTradeDAO.getTradeById.mockResolvedValueOnce(testTrade);
        });
        it("should throw an error if a non-admin, non-trade participator tries to update it", async () => {
            const otherUser = UserFactory.getOwnerUser();
            await expect(tradeController.updateTrade(otherUser, testTrade.id!, testTrade.parse())).rejects.toThrow(
                UnauthorizedError
            );
        });
        it("should allow any updates by admins even if not part of the trade", async () => {
            const otherUser = UserFactory.getAdminUser();
            await tradeController.updateTrade(otherUser, testTrade.id!, {
                status: TradeStatus.ACCEPTED,
                tradeParticipants: [],
                tradeItems: [],
            });

            expect(mockTradeDAO.updateStatus).toHaveBeenCalledTimes(1);
            expect(mockTradeDAO.updateStatus).toHaveBeenCalledWith(testTrade.id, TradeStatus.ACCEPTED);
            expect(mockTradeDAO.updateItems).toHaveBeenCalledTimes(1);
            expect(mockTradeDAO.updateItems).toHaveBeenCalledWith(testTrade.id, [], testTrade.tradeItems);
            expect(mockTradeDAO.updateParticipants).toHaveBeenCalledTimes(1);
            expect(mockTradeDAO.updateParticipants).toHaveBeenCalledWith(testTrade.id, [], testTrade.tradeParticipants);
        });
        it("should not call updateStatus DAO method if user is requesting an invalid status state change", async () => {
            // Trying to go from DRAFT -> ACCEPTED as trade owner is not an allowed state change
            await tradeController.updateTrade(tradeOwner, testTrade.id!, {
                status: TradeStatus.ACCEPTED,
                tradeParticipants: [],
                tradeItems: [],
            });

            expect(mockTradeDAO.updateStatus).toHaveBeenCalledTimes(0);
            expect(mockTradeDAO.updateItems).toHaveBeenCalledTimes(1);
            expect(mockTradeDAO.updateParticipants).toHaveBeenCalledTimes(1);
        });
        it("should call updateStatus DAO method if user is requesting a valid status state change", async () => {
            // Trying to go from DRAFT -> ACCEPTED as trade owner is not an allowed state change
            await tradeController.updateTrade(tradeOwner, testTrade.id!, { status: TradeStatus.REQUESTED });

            expect(mockTradeDAO.updateStatus).toHaveBeenCalledTimes(1);
        });
        it("should not allow updates to draft trade if not creator of the trade", async () => {
            await tradeController.updateTrade(tradeRecipient, testTrade.id!, { status: TradeStatus.REQUESTED });

            expect(mockTradeDAO.updateStatus).toHaveBeenCalledTimes(0);
        });
        it("should not allow updates to trade items or participants if not the owner of the trade", async () => {
            await tradeController.updateTrade(tradeRecipient, testTrade.id!, { tradeParticipants: [], tradeItems: [] });

            expect(mockTradeDAO.updateItems).toHaveBeenCalledTimes(0);
            expect(mockTradeDAO.updateParticipants).toHaveBeenCalledTimes(0);
        });
        it("should not allow item/participant updates to non-draft trades", async () => {
            const activeTrade = new Trade({ ...testTrade, status: TradeStatus.ACCEPTED });
            mockTradeDAO.getTradeById.mockReset();
            mockTradeDAO.getTradeById.mockResolvedValue(activeTrade);

            await tradeController.updateTrade(tradeOwner, testTrade.id!, { tradeParticipants: [], tradeItems: [] });

            expect(mockTradeDAO.updateItems).toHaveBeenCalledTimes(0);
            expect(mockTradeDAO.updateParticipants).toHaveBeenCalledTimes(0);
        });
        it("should call the updateParticipants method with correct args", async () => {
            const newCreator = TradeFactory.getTradeCreator(TeamFactory.getTeam());
            const updatedTrade = new Trade({ ...testTrade.parse(), tradeParticipants: [newCreator, recipient!] });
            mockTradeDAO.updateParticipants.mockResolvedValueOnce(updatedTrade);
            mockTradeDAO.updateItems.mockResolvedValueOnce(updatedTrade);

            const res = await tradeController.updateTrade(tradeOwner, testTrade.id!, updatedTrade.parse());

            expect(mockTradeDAO.updateParticipants).toHaveBeenCalledTimes(1);
            expect(mockTradeDAO.updateParticipants).toHaveBeenCalledWith(testTrade.id, [newCreator], [creator]);
            expect(res).toMatchObject({
                id: updatedTrade.id,

                tradeItems: expect.toIncludeSameMembers(testTrade.tradeItems!),

                tradeParticipants: expect.toIncludeSameMembers([newCreator, recipient]),
            });
        });
        it("should call the updateItems method with correct args", async () => {
            const newPick = TradeFactory.getTradedPick(
                undefined,
                testTrade.tradeParticipants![0].team,
                testTrade.tradeParticipants![1].team
            );
            const existingPlayers = testTrade.tradeItems!.filter(item => item.tradeItemType !== TradeItemType.PICK);
            const existingPick = testTrade.tradeItems!.find(item => item.tradeItemType === TradeItemType.PICK);
            const updatedTrade = new Trade({ ...testTrade.parse(), tradeItems: [newPick, ...existingPlayers] });
            mockTradeDAO.updateItems.mockResolvedValueOnce(updatedTrade);
            mockTradeDAO.updateParticipants.mockResolvedValueOnce(updatedTrade);

            const res = await tradeController.updateTrade(tradeOwner, testTrade.id!, updatedTrade.parse());

            expect(mockTradeDAO.updateItems).toHaveBeenCalledTimes(1);
            expect(mockTradeDAO.updateItems).toHaveBeenCalledWith(testTrade.id, [newPick], [existingPick]);
            expect(res).toMatchObject({
                id: updatedTrade.id,

                tradeParticipants: expect.toIncludeSameMembers(testTrade.tradeParticipants!),

                tradeItems: expect.toIncludeSameMembers([newPick, ...existingPlayers]),
            });
        });
        it("should call the updateDeclinedBy DAO method if valid", async () => {
            const declinedById = testTrade.tradeParticipants?.[1].team.owners?.[0].id;
            const declinedReason = "reason";
            await tradeController.updateTrade(tradeOwner, testTrade.id!, { declinedById, declinedReason });

            expect(mockTradeDAO.updateDeclinedBy).toHaveBeenCalledTimes(1);
            expect(mockTradeDAO.updateDeclinedBy).toHaveBeenCalledWith(testTrade.id, declinedById, declinedReason);
            expect(mockTradeDAO.updateStatus).toHaveBeenCalledTimes(0);
            expect(mockTradeDAO.updateItems).toHaveBeenCalledTimes(0);
            expect(mockTradeDAO.updateParticipants).toHaveBeenCalledTimes(0);
        });
        it("should not call updateDeclinedBy DAO method if declined by user is not one of the trade's own participants", async () => {
            const declinedById = TradeFactory.getTrade().tradeParticipants?.[1].team.owners?.[0].id;
            const declinedReason = "reason";
            await tradeController.updateTrade(tradeOwner, testTrade.id!, { declinedById, declinedReason });

            expect(mockTradeDAO.updateDeclinedBy).toHaveBeenCalledTimes(0);
            expect(mockTradeDAO.updateStatus).toHaveBeenCalledTimes(0);
            expect(mockTradeDAO.updateItems).toHaveBeenCalledTimes(0);
            expect(mockTradeDAO.updateParticipants).toHaveBeenCalledTimes(0);
        });
    });

    describe("acceptTrade method", () => {
        beforeEach(() => {
            mockTradeDAO.getTradeById.mockResolvedValue(testTrade);
        });

        it("should throw an error if a non-admin, non-trade participator tries to update it", async () => {
            const otherUser = UserFactory.getOwnerUser();
            await expect(tradeController.acceptTrade(otherUser, testTrade.id!)).rejects.toThrow(UnauthorizedError);
        });
        it("should only allow accepting trades with the status of REQUESTED or PENDING", async () => {
            const validStatuses = [TradeStatus.REQUESTED, TradeStatus.PENDING];
            const invalidStatuses = [
                TradeStatus.DRAFT,
                TradeStatus.ACCEPTED,
                TradeStatus.REJECTED,
                TradeStatus.SUBMITTED,
            ];

            for (const status of invalidStatuses) {
                mockTradeDAO.getTradeById.mockReset();
                mockTradeDAO.getTradeById.mockResolvedValueOnce(new Trade({ ...testTrade.parse(), status }));
                await expect(tradeController.acceptTrade(tradeRecipient, testTrade.id!)).rejects.toThrow(
                    BadRequestError
                );
            }

            for (const status of validStatuses) {
                mockTradeDAO.getTradeById.mockReset();
                mockTradeDAO.getTradeById.mockResolvedValueOnce(new Trade({ ...testTrade.parse(), status }));
                mockTradeDAO.updateStatus.mockResolvedValueOnce(new Trade({ ...testTrade.parse(), status }));

                await expect(tradeController.acceptTrade(tradeRecipient, testTrade.id!)).resolves.toBeDefined();
            }
        });
        it("should updated the acceptedBy field for valid trades by adding the accepting user's id to the acceptedBy field", async () => {
            const additionalRecipient = TradeFactory.getTradeRecipient(
                TeamFactory.getTeam("RECIPIENT_TEAM_2"),
                testTrade
            );
            const additionalRecipientUser = UserFactory.getOwnerUser();
            additionalRecipient.team.owners = [additionalRecipientUser];
            const tradeParticipants = testTrade.tradeParticipants?.concat([additionalRecipient]);
            const status = TradeStatus.REQUESTED;
            const acceptedBy = [additionalRecipient.id!];
            mockTradeDAO.getTradeById.mockReset();
            mockTradeDAO.getTradeById.mockResolvedValueOnce(
                new Trade({
                    ...testTrade,
                    status,
                    tradeParticipants,
                    acceptedBy,
                })
            );

            await tradeController.acceptTrade(tradeRecipient, testTrade.id!);

            expect(mockTradeDAO.updateAcceptedBy).toHaveBeenCalledTimes(1);
            expect(mockTradeDAO.updateAcceptedBy).toHaveBeenCalledWith(testTrade.id, [
                additionalRecipient.id,
                tradeRecipient.id,
            ]);
        });
        it("should update the trade status to ACCEPTED if all recipients have accepted", async () => {
            mockTradeDAO.getTradeById.mockReset();
            mockTradeDAO.getTradeById.mockResolvedValueOnce(new Trade({ ...testTrade, status: TradeStatus.REQUESTED }));

            await tradeController.acceptTrade(tradeRecipient, testTrade.id!);

            expect(mockTradeDAO.updateStatus).toHaveBeenCalledTimes(1);
            expect(mockTradeDAO.updateStatus).toHaveBeenCalledWith(testTrade.id, TradeStatus.ACCEPTED);
        });
        it("should update the trade status to PENDING if not all recipients have responded yet", async () => {
            const additionalRecipient = TradeFactory.getTradeRecipient(
                TeamFactory.getTeam("RECIPIENT_TEAM_2"),
                testTrade
            );
            const additionalRecipientUser = UserFactory.getOwnerUser();
            additionalRecipient.team.owners = [additionalRecipientUser];
            mockTradeDAO.getTradeById.mockReset();
            mockTradeDAO.getTradeById.mockResolvedValueOnce(
                new Trade({
                    ...testTrade,
                    status: TradeStatus.REQUESTED,
                    tradeParticipants: testTrade.tradeParticipants?.concat([additionalRecipient]),
                })
            );

            await tradeController.acceptTrade(tradeRecipient, testTrade.id!);

            expect(mockTradeDAO.updateStatus).toHaveBeenCalledTimes(1);
            expect(mockTradeDAO.updateStatus).toHaveBeenCalledWith(testTrade.id, TradeStatus.PENDING);
        });
        it("should stay at PENDING if the accepting user is from the same team as an existing entry in the acceptedBy field", async () => {
            // The existing trade recipient has an additional owner for a total of two owners on that team
            const tradeRecipientSecondOwner = UserFactory.getOwnerUser();
            recipient!.team.owners = [tradeRecipient, tradeRecipientSecondOwner];

            // Trade has an additional recipient for a total of two recipient teams
            const additionalRecipient = TradeFactory.getTradeRecipient(
                TeamFactory.getTeam("RECIPIENT_TEAM_2"),
                testTrade
            );
            const additionalRecipientUser = UserFactory.getOwnerUser();
            additionalRecipient.team.owners = [additionalRecipientUser];

            // let's say that the secondOwner already accepted the trade
            const acceptedBy = [tradeRecipientSecondOwner.id!];

            // Update mocks
            mockTradeDAO.getTradeById.mockReset();
            mockTradeDAO.getTradeById.mockResolvedValueOnce(
                new Trade({
                    ...testTrade,
                    status: TradeStatus.REQUESTED,
                    tradeParticipants: testTrade.tradeParticipants?.concat([additionalRecipient]),
                    acceptedBy,
                })
            );

            await tradeController.acceptTrade(tradeRecipient, testTrade.id!);

            expect(mockTradeDAO.updateStatus).toHaveBeenCalledTimes(1);
            expect(mockTradeDAO.updateStatus).toHaveBeenCalledWith(testTrade.id, TradeStatus.PENDING);
        });
        it("should reject the trade if the user who is trying to accept is not a recipient of the trade", async () => {
            const validStatuses = [TradeStatus.REQUESTED, TradeStatus.PENDING];

            for (const status of validStatuses) {
                mockTradeDAO.getTradeById.mockReset();
                mockTradeDAO.getTradeById.mockResolvedValueOnce(new Trade({ ...testTrade.parse(), status }));
                mockTradeDAO.updateStatus.mockResolvedValueOnce(new Trade({ ...testTrade.parse(), status }));

                await expect(tradeController.acceptTrade(tradeOwner, testTrade.id!)).rejects.toThrow(UnauthorizedError);
            }
        });
        it("should reject the trade if the user who is trying to accept has already been added to the acceptedBy field", async () => {
            const validStatuses = [TradeStatus.REQUESTED, TradeStatus.PENDING];
            const acceptedBy = [tradeRecipient.id!];

            for (const status of validStatuses) {
                mockTradeDAO.getTradeById.mockReset();
                mockTradeDAO.getTradeById.mockResolvedValueOnce(
                    new Trade({
                        ...testTrade,
                        status,
                        acceptedBy,
                    })
                );
                mockTradeDAO.updateStatus.mockResolvedValueOnce(new Trade({ ...testTrade.parse(), status }));

                await expect(tradeController.acceptTrade(tradeRecipient, testTrade.id!)).rejects.toThrow(
                    BadRequestError
                );
            }
        });
    });

    describe("rejectTrade method", () => {
        beforeEach(() => {
            mockTradeDAO.getTradeById.mockResolvedValue(testTrade);
        });

        it("should throw an error if a non-admin, non-trade participator tries to update it", async () => {
            const otherUser = UserFactory.getOwnerUser();

            await expect(
                tradeController.rejectTrade(otherUser, testTrade.id!, tradeRecipient.id!, "reason")
            ).rejects.toThrow(UnauthorizedError);
        });

        it("should throw an error if the owner tries to update it", async () => {
            await expect(
                tradeController.rejectTrade(tradeOwner, testTrade.id!, tradeRecipient.id!, "reason")
            ).rejects.toThrow(UnauthorizedError);
        });

        it("should only allow accepting trades with the status of REQUESTED or PENDING", async () => {
            const validStatuses = [TradeStatus.REQUESTED, TradeStatus.PENDING];
            const invalidStatuses = [
                TradeStatus.DRAFT,
                TradeStatus.ACCEPTED,
                TradeStatus.REJECTED,
                TradeStatus.SUBMITTED,
            ];

            for (const status of invalidStatuses) {
                mockTradeDAO.getTradeById.mockReset();
                mockTradeDAO.getTradeById.mockResolvedValueOnce(new Trade({ ...testTrade.parse(), status }));

                await expect(
                    tradeController.rejectTrade(tradeRecipient, testTrade.id!, tradeRecipient.id!, "reason")
                ).rejects.toThrow(BadRequestError);
            }

            for (const status of validStatuses) {
                mockTradeDAO.getTradeById.mockReset();
                mockTradeDAO.getTradeById.mockResolvedValueOnce(new Trade({ ...testTrade.parse(), status }));
                mockTradeDAO.updateStatus.mockResolvedValueOnce(new Trade({ ...testTrade.parse(), status }));

                await expect(
                    tradeController.rejectTrade(tradeRecipient, testTrade.id!, tradeRecipient.id!, "reason")
                ).resolves.toBeDefined();
            }
        });

        it("should updated the declined by and declined reason fields for valid trades and update the status to REJECTED", async () => {
            mockTradeDAO.getTradeById.mockReset();
            mockTradeDAO.getTradeById.mockResolvedValueOnce(new Trade({ ...testTrade, status: TradeStatus.REQUESTED }));

            await tradeController.rejectTrade(tradeRecipient, testTrade.id!, tradeRecipient.id!, "reason");

            expect(mockTradeDAO.updateDeclinedBy).toHaveBeenCalledTimes(1);
            expect(mockTradeDAO.updateDeclinedBy).toHaveBeenCalledWith(testTrade.id, tradeRecipient.id, "reason");
            expect(mockTradeDAO.updateStatus).toHaveBeenCalledTimes(1);
            expect(mockTradeDAO.updateStatus).toHaveBeenCalledWith(testTrade.id, TradeStatus.REJECTED);
        });
    });

    describe("submitTrade method", () => {
        const acceptedTrade = new Trade({ ...testTrade.parse(), status: TradeStatus.ACCEPTED });
        beforeEach(() => {
            mockTradeDAO.getTradeById.mockReset();
            mockTradeDAO.getTradeById.mockResolvedValueOnce(acceptedTrade);
            mockTradeDAO.hydrateTrade.mockResolvedValueOnce(acceptedTrade);
        });

        it("should throw an error if a non-admin, non-trade participator tries to update it", async () => {
            const otherUser = UserFactory.getOwnerUser();

            await expect(tradeController.submitTrade(otherUser, acceptedTrade.id!)).rejects.toThrow(UnauthorizedError);
        });

        it("should throw an error if a trade recipient tries to update it", async () => {
            await expect(tradeController.submitTrade(tradeRecipient, acceptedTrade.id!)).rejects.toThrow(
                UnauthorizedError
            );
        });

        it("should only allow accepting trades with the status of ACCEPTED", async () => {
            const validStatuses = [TradeStatus.ACCEPTED];
            const invalidStatuses = [
                TradeStatus.DRAFT,
                TradeStatus.REQUESTED,
                TradeStatus.REJECTED,
                TradeStatus.SUBMITTED,
                TradeStatus.PENDING,
            ];

            for (const status of invalidStatuses) {
                mockTradeDAO.getTradeById.mockReset();
                mockTradeDAO.getTradeById.mockResolvedValueOnce(new Trade({ ...testTrade.parse(), status }));

                await expect(tradeController.submitTrade(tradeOwner, testTrade.id!)).rejects.toThrow(BadRequestError);
            }

            for (const status of validStatuses) {
                mockTradeDAO.getTradeById.mockReset();
                const tradeWithStatus = new Trade({ ...testTrade.parse(), status });
                mockTradeDAO.getTradeById.mockResolvedValueOnce(tradeWithStatus);
                mockTradeDAO.hydrateTrade.mockResolvedValueOnce(tradeWithStatus);
                mockTradeDAO.updateStatus.mockResolvedValueOnce(tradeWithStatus);

                await expect(tradeController.submitTrade(tradeOwner, testTrade.id!)).resolves.toBeDefined();
            }
        });

        it("should hydrate the trade, append it to the trade tracker, and update the status to SUBMITTED", async () => {
            await tradeController.submitTrade(tradeOwner, acceptedTrade.id!);

            expect(mockTradeDAO.hydrateTrade).toHaveBeenCalledTimes(1);
            expect(mockTradeDAO.hydrateTrade).toHaveBeenCalledWith(acceptedTrade);
            expect(mockTradeDAO.updateStatus).toHaveBeenCalledTimes(1);
            expect(mockTradeDAO.updateStatus).toHaveBeenCalledWith(acceptedTrade.id, TradeStatus.SUBMITTED);
        });
    });

    describe("deleteTrade method", () => {
        it("should delete a trade by id from the db", async () => {
            mockTradeDAO.deleteTrade.mockResolvedValueOnce({ raw: [{ id: testTrade.id! } as Trade], affected: 1 });
            const res = await tradeController.deleteTrade(testTrade.id!);

            expect(mockTradeDAO.deleteTrade).toHaveBeenCalledTimes(1);
            expect(mockTradeDAO.deleteTrade).toHaveBeenCalledWith(testTrade.id);
            expect(res).toEqual({ deleteCount: 1, id: testTrade.id });
        });
    });
});
