// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { registerUser, loginUser, logoutUser, getCurrentUser } from "./auth";

beforeEach(() => {
  localStorage.clear();
});

describe("registerUser", () => {
  it("registers a new user and returns session", async () => {
    const session = await registerUser("Test@Example.com", "password123", "Alice");
    expect(session.email).toBe("test@example.com");
    expect(session.displayName).toBe("Alice");
  });

  it("throws on empty email or password", async () => {
    await expect(registerUser("", "pass123")).rejects.toThrow("requis");
    await expect(registerUser("a@b.com", "")).rejects.toThrow("requis");
  });

  it("throws on short password", async () => {
    await expect(registerUser("a@b.com", "123")).rejects.toThrow("6 caractères");
  });

  it("throws on invalid email", async () => {
    await expect(registerUser("notanemail", "password123")).rejects.toThrow("invalide");
  });

  it("throws on duplicate email", async () => {
    await registerUser("a@b.com", "password123");
    await expect(registerUser("a@b.com", "other123")).rejects.toThrow("existe déjà");
  });

  it("uses email prefix as displayName when none provided", async () => {
    const session = await registerUser("bob@test.com", "password123");
    expect(session.displayName).toBe("bob");
  });
});

describe("loginUser", () => {
  it("logs in an existing user", async () => {
    await registerUser("user@test.com", "mypassword", "User");
    logoutUser();
    const session = await loginUser("user@test.com", "mypassword");
    expect(session.email).toBe("user@test.com");
    expect(session.displayName).toBe("User");
  });

  it("throws on wrong password", async () => {
    await registerUser("user@test.com", "mypassword", "User");
    logoutUser();
    await expect(loginUser("user@test.com", "wrongpass")).rejects.toThrow("incorrect");
  });

  it("throws on unknown email", async () => {
    await expect(loginUser("unknown@test.com", "pass123")).rejects.toThrow("Aucun compte");
  });
});

describe("getCurrentUser / logoutUser", () => {
  it("returns null when no session", () => {
    expect(getCurrentUser()).toBeNull();
  });

  it("returns session after register", async () => {
    await registerUser("me@test.com", "password123", "Me");
    expect(getCurrentUser()).toEqual({ email: "me@test.com", displayName: "Me" });
  });

  it("returns null after logout", async () => {
    await registerUser("me@test.com", "password123", "Me");
    logoutUser();
    expect(getCurrentUser()).toBeNull();
  });
});
