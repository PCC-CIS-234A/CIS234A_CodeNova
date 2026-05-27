function isInvalidDateRange(from, to) {
    return Boolean(from && to && from > to);
}

module.exports = {
    isInvalidDateRange
};