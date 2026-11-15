import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Moonatics } from "@/components/game/moonatics";

afterEach(cleanup);

// The whole app is one page: it must open on the start screen and let a player begin.
describe("The app", () => {
  it("opens on the start screen and moves on to choosing a training mode", () => {
    render(<Moonatics />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("MOONATICS");
    fireEvent.click(screen.getByRole("button", { name: /BEGIN MISSION/i }));
    expect(screen.getByRole("button", { name: /Explorer/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Mission Specialist/i })).toBeTruthy();
  });
});
