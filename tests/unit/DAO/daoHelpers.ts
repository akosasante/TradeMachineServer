export const mockExecute = jest.fn();
export const mockWhereInIds = jest.fn().mockReturnValue({returning: jest.fn().mockReturnValue({execute: mockExecute})});
export const mockDeleteChain = {
    delete: jest.fn().mockReturnValue(
        {whereInIds: mockWhereInIds}),
};

export interface MockDb {
    [key: string]: jest.Mock<any, any>;
}