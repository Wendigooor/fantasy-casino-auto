import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { HealthPage } from "./pages/HealthPage";

describe("HealthPage", () => {
  it("should render without crashing", () => {
    const { getByText } = render(<HealthPage />);
    expect(getByText("Health Check")).toBeInTheDocument();
  });
});

describe("Layout", () => {
  it("should render children", () => {
    const { getByText } = render(
      <div>test content</div>
    );
    expect(getByText("test content")).toBeInTheDocument();
  });
});
