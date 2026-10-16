import { cleanup, fireEvent, render } from "@solidjs/testing-library";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => ({ navigate: vi.fn() }));

vi.mock("animejs", () => ({ animate: vi.fn() }));
vi.mock("../../../../../src/ts/navigation/navigation", () => ({
  navigate: mocks.navigate,
}));

import { ResultDailyLeaderboard } from "../../../../../src/features/typing/components/result/ResultDailyLeaderboard";
import { __testing } from "../../../../../src/ts/config/testing";
import { setResultState } from "../../../../../src/ts/states/result";

function renderGroup(): HTMLElement {
  const { container } = render(() => (
    <ResultDailyLeaderboard topClass="top" bottomClass="bottom" />
  ));
  return container;
}

describe("ResultDailyLeaderboard", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    setResultState("dailyLeaderboardRank", undefined);
  });

  it("renders nothing without a rank", () => {
    expect(renderGroup().querySelector(".dailyLeaderboard")).toBeNull();
  });

  it("shows the formatted rank", () => {
    const container = renderGroup();

    setResultState("dailyLeaderboardRank", 12);
    expect(container.querySelector("#dailyLeaderboardRank")).toHaveTextContent(
      "12th",
    );

    setResultState("dailyLeaderboardRank", 0);
    expect(container.querySelector("#dailyLeaderboardRank")).toHaveTextContent(
      "0th",
    );
  });

  it("opens the daily leaderboard", () => {
    __testing.replaceConfig({ language: "english", mode: "time", time: 15 });
    setResultState("dailyLeaderboardRank", 3);
    const container = renderGroup();

    fireEvent.click(
      container.querySelector("#dailyLeaderboardRank") as HTMLElement,
    );
    expect(mocks.navigate).toHaveBeenCalledWith(
      "/leaderboards?type=daily&language=english&mode2=15&goToUserPage=true",
    );
  });
});
