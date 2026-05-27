const assert = require("assert");
const { isInvalidDateRange } = require("../logic/validation");

describe("Notification Date Validation", () => {

    it("returns false when From date is before To date", () => {
        assert.strictEqual(
            isInvalidDateRange("2026-04-01", "2026-04-10"),
            false
        );
    });

    it("returns true when From date is after To date", () => {
        assert.strictEqual(
            isInvalidDateRange("2026-04-20", "2026-04-10"),
            true
        );
    });

    it("returns false when From date and To date are the same", () => {
        assert.strictEqual(
            isInvalidDateRange("2026-04-10", "2026-04-10"),
            false
        );
    });

    it("returns false when From date is missing", () => {
        assert.strictEqual(
            isInvalidDateRange("", "2026-04-10"),
            false
        );
    });

    it("returns false when To date is missing", () => {
        assert.strictEqual(
            isInvalidDateRange("2026-04-10", ""),
            false
        );
    });

});