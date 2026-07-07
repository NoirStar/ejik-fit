import { bench, describe } from "vitest";

import { buildMarketGraphArtifact } from "./market-graph-artifact";
import {
  LARGE_GRAPH_FIXTURE_SIZES,
  buildLargeSkillGraphViewFixture,
} from "./large-graph-fixture";
import { selectGraphRenderer } from "./graph-renderer";


describe("large graph artifact benchmark", () => {
  for (const nodeCount of LARGE_GRAPH_FIXTURE_SIZES) {
    const view = buildLargeSkillGraphViewFixture({ nodeCount });

    bench(
      `select renderer + build artifact for ${nodeCount.toLocaleString()} nodes`,
      () => {
        selectGraphRenderer(view);
        buildMarketGraphArtifact(view, {
          generatedAt: "2026-07-07T00:00:00.000Z",
        });
      },
      {
        iterations: 5,
        warmupIterations: 1,
      },
    );
  }
});
