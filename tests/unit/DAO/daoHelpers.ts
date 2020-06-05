export const mockExecute = jest.fn();
export const mockReturning = jest.fn();
export const mockWhereInIds = jest.fn();
export const mockDeleteChain = {
    delete: jest.fn()
        .mockReturnValue({ whereInIds: mockWhereInIds
                .mockReturnValue({ returning: mockReturning
                        .mockReturnValue({ execute: mockExecute })})}),
};

export interface MockObj {
    [key: string]: jest.Mock<any, any>;
}
