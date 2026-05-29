import { describe, expect, it } from "vitest";

import type { ParsedResume } from "@/lib/ats/parse-sections";
import {
  type ContactFieldStatus,
  normaliseLkPhone,
  validateContact,
} from "@/lib/ats/contact-validation";

type Contact = ParsedResume["contact"];

/** Build a contact block with every field null, overriding only what a test cares about. */
function makeContact(overrides: Partial<Contact> = {}): Contact {
  return {
    name: null,
    email: null,
    phone: null,
    location: null,
    linkedin: null,
    github: null,
    website: null,
    ...overrides,
  };
}

/** Wrap a contact block in a minimal ParsedResume — validateContact only reads `.contact`. */
function withContact(overrides: Partial<Contact> = {}): ParsedResume {
  return { contact: makeContact(overrides) } as unknown as ParsedResume;
}

/** Find the finding for a given field. */
function statusOf(parsed: ParsedResume, field: string): ContactFieldStatus | undefined {
  return validateContact(parsed).findings.find((f) => f.field === field)?.status;
}

describe("normaliseLkPhone", () => {
  it("normalises +94 international format, stripping separators", () => {
    expect(normaliseLkPhone("+94 77 123 4567")).toBe("+94771234567");
    expect(normaliseLkPhone("+94-77-1234567")).toBe("+94771234567");
  });

  it("adds the + prefix when missing on a 94-prefixed number", () => {
    expect(normaliseLkPhone("94771234567")).toBe("+94771234567");
  });

  it("converts 0-prefixed local numbers to +94", () => {
    expect(normaliseLkPhone("0771234567")).toBe("+94771234567");
    expect(normaliseLkPhone("077-123-4567")).toBe("+94771234567");
  });

  it("returns null for non-LK or malformed numbers", () => {
    expect(normaliseLkPhone("+12025550173")).toBeNull();
    expect(normaliseLkPhone("12345")).toBeNull();
    expect(normaliseLkPhone("")).toBeNull();
  });
});

describe("validateContact — name", () => {
  it("flags a missing name as an issue", () => {
    const report = validateContact(withContact());
    expect(statusOf(withContact(), "name")).toBe("missing");
    expect(report.issues).toContain("Name not detected in the resume header");
  });

  it("accepts a normal title-cased name", () => {
    expect(statusOf(withContact({ name: "Jane Doe" }), "name")).toBe("valid");
  });

  it("warns on an ALL CAPS name", () => {
    expect(statusOf(withContact({ name: "JOHN SMITH" }), "name")).toBe("warning");
  });

  it("warns when the header line is unusually long", () => {
    expect(statusOf(withContact({ name: "a".repeat(60) }), "name")).toBe("warning");
  });
});

describe("validateContact — email", () => {
  it("flags a missing email", () => {
    expect(statusOf(withContact(), "email")).toBe("missing");
  });

  it("marks a malformed email invalid", () => {
    expect(statusOf(withContact({ email: "not-an-email" }), "email")).toBe("invalid");
  });

  it("accepts a professional handle", () => {
    expect(statusOf(withContact({ email: "jane.doe@example.com" }), "email")).toBe("valid");
  });

  it("warns on an unprofessional handle", () => {
    expect(statusOf(withContact({ email: "cool_dude@hotmail.com" }), "email")).toBe("warning");
  });

  it("warns on a long digit run in the handle", () => {
    expect(statusOf(withContact({ email: "john1985@gmail.com" }), "email")).toBe("warning");
  });
});

describe("validateContact — phone", () => {
  it("accepts a Sri Lankan +94 number", () => {
    expect(statusOf(withContact({ phone: "+94771234567" }), "phone")).toBe("valid");
  });

  it("warns on a local 0-prefixed LK number (missing country code)", () => {
    expect(statusOf(withContact({ phone: "0771234567" }), "phone")).toBe("warning");
  });

  it("accepts a generic international number", () => {
    expect(statusOf(withContact({ phone: "+12025550173" }), "phone")).toBe("valid");
  });

  it("marks an absurdly short number invalid", () => {
    expect(statusOf(withContact({ phone: "12345" }), "phone")).toBe("invalid");
  });

  it("warns on a long number with no country code", () => {
    expect(statusOf(withContact({ phone: "5551234567" }), "phone")).toBe("warning");
  });
});

describe("validateContact — location, linkedin, github", () => {
  it("warns when location has no comma", () => {
    expect(statusOf(withContact({ location: "Sri Lanka" }), "location")).toBe("warning");
  });

  it("accepts City, Country location", () => {
    expect(statusOf(withContact({ location: "Colombo, Sri Lanka" }), "location")).toBe("valid");
  });

  it("accepts a well-formed LinkedIn URL", () => {
    expect(
      statusOf(withContact({ linkedin: "https://www.linkedin.com/in/jane-doe" }), "linkedin"),
    ).toBe("valid");
  });

  it("marks a malformed LinkedIn URL invalid", () => {
    expect(statusOf(withContact({ linkedin: "linkedin.com/jane" }), "linkedin")).toBe("invalid");
  });

  it("only emits a github finding when github is present", () => {
    expect(validateContact(withContact()).findings.some((f) => f.field === "github")).toBe(false);
    expect(statusOf(withContact({ github: "https://github.com/janedoe" }), "github")).toBe("valid");
    expect(statusOf(withContact({ github: "github.com/jane/extra/path" }), "github")).toBe(
      "invalid",
    );
  });
});

describe("validateContact — score", () => {
  it("scores 0 when every field is missing", () => {
    expect(validateContact(withContact()).score).toBe(0);
  });

  it("scores 100 when every detected field is valid", () => {
    const report = validateContact(
      withContact({
        name: "Jane Doe",
        email: "jane.doe@example.com",
        phone: "+94771234567",
        location: "Colombo, Sri Lanka",
        linkedin: "https://www.linkedin.com/in/jane-doe",
      }),
    );
    expect(report.score).toBe(100);
    expect(report.issues).toHaveLength(0);
  });

  it("counts a warning as half credit", () => {
    // Four valid + one warning (local phone) across five findings => (4 + 0.5)/5 = 90.
    const report = validateContact(
      withContact({
        name: "Jane Doe",
        email: "jane.doe@example.com",
        phone: "0771234567",
        location: "Colombo, Sri Lanka",
        linkedin: "https://www.linkedin.com/in/jane-doe",
      }),
    );
    expect(report.score).toBe(90);
  });
});
