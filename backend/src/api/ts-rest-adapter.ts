import { HttpRequest } from "./http";
import { MonkeyResponse } from "../utils/monkey-response";
import { MonkeyRequest } from "./types";

export function callController<TQuery, TBody, TParams, TResponse>(
  handler: MonkeyHandler<TQuery, TBody, TParams, TResponse>,
): (all: TypeSafeTsRestRequest<TQuery, TBody, TParams>) => Promise<{
  status: 200;
  body: MonkeyResponse<TResponse>;
}> {
  return async (all) => {
    const req: MonkeyRequest<TQuery, TBody, TParams> = {
      body: all.body as TBody,
      query: all.query as TQuery,
      params: all.params as TParams,
      raw: all.req,
      ctx: all.req.ctx,
    };

    const result = await handler(req);
    const response = {
      status: 200 as const,
      body: {
        message: result.message,
        data: result.data,
      },
    };

    return response;
  };
}

type WithBody<T> = {
  body: T;
};
type WithQuery<T> = {
  query: T;
};

type WithParams<T> = {
  params: T;
};

type WithoutBody = {
  body?: never;
};
type WithoutQuery = {
  query?: never;
};
type WithoutParams = {
  params?: never;
};

type MonkeyHandler<TQuery, TBody, TParams, TResponse> = (
  req: MonkeyRequest<TQuery, TBody, TParams>,
) => Promise<MonkeyResponse<TResponse>>;

type TypeSafeTsRestRequest<TQuery, TBody, TParams> = {
  req: HttpRequest;
} & (TQuery extends undefined ? WithoutQuery : WithQuery<TQuery>) &
  (TBody extends undefined ? WithoutBody : WithBody<TBody>) &
  (TParams extends undefined ? WithoutParams : WithParams<TParams>);
