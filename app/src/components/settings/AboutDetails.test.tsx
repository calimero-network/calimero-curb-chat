import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AboutDetails from "./AboutDetails";

describe("AboutDetails", () => {
  it("still lets members leave channels named general", () => {
    const handleLeaveChannel = vi.fn();

    render(
      <AboutDetails
        channelName="general"
        dateCreated=""
        manager="Owner"
        handleLeaveChannel={handleLeaveChannel}
      />,
    );

    fireEvent.click(screen.getByText(/leave channel/i));

    expect(handleLeaveChannel).toHaveBeenCalledTimes(1);
  });
});
