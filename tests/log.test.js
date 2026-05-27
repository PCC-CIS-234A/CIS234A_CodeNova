const { isInvalidDateRange } = require("../logic/validation");

describe("Notification Date Validation", () => {

    it("returns false when From date is before To date", () => {
        expect(isInvalidDateRange("2026-04-01", "2026-04-10")).toBe(false);
    });

    it("returns true when From date is after To date", () => {
        expect(isInvalidDateRange("2026-04-20", "2026-04-10")).toBe(true);
    });

    it("returns false when From date and To date are the same", () => {
        expect(isInvalidDateRange("2026-04-10", "2026-04-10")).toBe(false);
    });

    it("returns false when From date is missing", () => {
        expect(isInvalidDateRange("", "2026-04-10")).toBe(false);
    });

    it("returns false when To date is missing", () => {
        expect(isInvalidDateRange("2026-04-10", "")).toBe(false);
    });

});
