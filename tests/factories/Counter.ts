export const espnIdCounter = (function () {
    let counter = 1;

    return function () {
        return (counter += 1);
    };
})();
