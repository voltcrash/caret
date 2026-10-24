import { expect, it } from "vite-plus/test";
import { createTestClient } from "../__testData__/test-client";

const client = createTestClient(async (request) => {
  const url = new URL(request.url);
  return Response.json(
    {
      query: url.search,
      auth: request.headers.get("authorization"),
      body: request.method === "POST" ? await request.json() : null,
    },
    { status: 201 },
  );
});

it("sends headers, query and JSON body", async () => {
  const response = await client
    .post("/echo")
    .set("Authorization", "Bearer x")
    .query({ a: 1, tags: ["b", "c"] })
    .send({ ok: true })
    .expect(201);
  expect(response.type).toBe("application/json");
  expect(response.body).toEqual({
    query: "?a=1&tags=b&tags=c",
    auth: "Bearer x",
    body: { ok: true },
  });
});

it("rejects unexpected statuses", async () => {
  await expect(client.get("/echo").expect(200)).rejects.toThrow(
    "expected 200, got 201",
  );
});
