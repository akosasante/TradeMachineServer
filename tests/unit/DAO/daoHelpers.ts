export const mockExecute = jest.fn();
export const mockReturning = jest.fn();
export const mockWhereInIds = jest.fn();
export const mockDelete = jest.fn();
export const mockDeleteChain = {
    delete: mockDelete.mockReturnThis(),
    whereInIds: mockWhereInIds.mockReturnThis(),
    returning: mockReturning.mockReturnThis(),
    execute: mockExecute,
};

export interface MockObj {
    [key: string]: jest.Mock;
}
